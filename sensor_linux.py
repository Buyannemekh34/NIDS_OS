
import asyncio
import json
import subprocess
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scapy.all import IP, TCP, AsyncSniffer, get_if_list
from scapy.arch import get_if_addr, get_if_hwaddr
from starlette.responses import StreamingResponse


app = FastAPI(title="NIDS.OS Linux Sensor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

lock = threading.RLock()
event_loop = None
subscribers = set()
events = deque(maxlen=500)
sniffer = None

interface_name = None
bpf_filter = "ip or arp"
started_at = None
last_packet_at = None
last_error = None
packets_seen = 0
bytes_seen = 0
events_detected = 0

packet_times = deque(maxlen=3000)

scan_history = defaultdict(deque)
scan_alert_times = {}
syn_history = defaultdict(deque)
flood_alert_times = {}


class StartRequest(BaseModel):
    interface: str
    bpf: str = "ip or arp"


class StopRequest(BaseModel):
    pass


def now_iso():
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def emit(message):
    if event_loop is None:
        return

    def dispatch():
        for queue in list(subscribers):
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass

            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                pass

    try:
        event_loop.call_soon_threadsafe(dispatch)
    except RuntimeError:
        # The application event loop may be shutting down.
        pass


def status():
    now = time.time()

    with lock:
        while packet_times and packet_times[0] < now - 5:
            packet_times.popleft()

        return {
            "sensorVersion": "1.0.0",
            "platform": "Linux",
            "captureActive": bool(sniffer and sniffer.running),
            "interface": interface_name,
            "bpf": bpf_filter,
            "startedAt": started_at,
            "lastPacketAt": last_packet_at,
            "packetsSeen": packets_seen,
            "bytesSeen": bytes_seen,
            "eventsDetected": events_detected,
            "packetsPerSecond": round(len(packet_times) / 5, 2),
            "error": last_error,
            "npcapRequired": False,
            "rules": [
                {
                    "id": "port-scan",
                    "name": "TCP SYN port scan heuristic",
                    "enabled": True,
                },
                {
                    "id": "syn-rate",
                    "name": "High-rate TCP SYN heuristic",
                    "enabled": True,
                },
            ],
        }


def add_event(
    category,
    title,
    severity,
    src,
    dst,
    evidence,
    port=None,
    technique=None,
):
    global events_detected

    event = {
        "id": str(uuid.uuid4()),
        "timestamp": now_iso(),
        "category": category,
        "title": title,
        "severity": severity,
        "source": "linux-scapy-sensor",
        "sourceIp": src,
        "targetIp": dst,
        "evidence": evidence,
        "action": "observed",
        "interface": interface_name,
    }

    if port is not None:
        event["targetPort"] = port

    if technique:
        event["mitreTechnique"] = technique

    with lock:
        events.appendleft(event)
        events_detected += 1

    emit({"type": "sensor_event", "data": event})
    emit({"type": "sensor_status", "data": status()})


def handle_packet(packet):
    global packets_seen, bytes_seen, last_packet_at

    now = time.time()

    with lock:
        packets_seen += 1
        bytes_seen += len(packet)
        last_packet_at = now_iso()
        packet_times.append(now)

    if not packet.haslayer(IP):
        return

    ip = packet[IP]
    src = str(ip.src)
    dst = str(ip.dst)

    if not packet.haslayer(TCP):
        return

    tcp = packet[TCP]
    flags = int(tcp.flags)

    # Count initial TCP SYN packets, excluding SYN-ACK replies.
    if not (flags & 0x02) or (flags & 0x10):
        return

    port = int(tcp.dport)
    key = (src, dst)

    # TCP SYN port-scan heuristic: 12 distinct ports in 10 seconds.
    history = scan_history[key]
    history.append((now, port))

    while history and history[0][0] < now - 10:
        history.popleft()

    unique_ports = {p for _, p in history}

    if (
        len(unique_ports) >= 12
        and now - scan_alert_times.get(key, 0) >= 30
    ):
        scan_alert_times[key] = now

        add_event(
            "port_scan",
            "Possible TCP SYN port scan",
            "high",
            src,
            dst,
            (
                f"SYN packets reached {len(unique_ports)} distinct "
                "destination ports in 10 seconds. "
                "This heuristic is not proof of an attack."
            ),
            technique="T1046",
        )

    # High-rate TCP SYN heuristic: 100 packets to one port in 5 seconds.
    flood_key = (src, dst, port)
    flood = syn_history[flood_key]
    flood.append(now)

    while flood and flood[0] < now - 5:
        flood.popleft()

    if (
        len(flood) >= 100
        and now - flood_alert_times.get(flood_key, 0) >= 30
    ):
        flood_alert_times[flood_key] = now

        add_event(
            "dos_flood",
            "High-rate TCP SYN traffic",
            "high",
            src,
            dst,
            (
                f"Observed {len(flood)} initial SYN packets to port "
                f"{port} in 5 seconds. "
                "This heuristic is not proof of a denial-of-service attack."
            ),
            port=port,
            technique="T1498",
        )


def get_linux_ipv4(name):
    """Read an interface IPv4 address directly from Linux."""
    try:
        output = subprocess.check_output(
            ["ip", "-4", "-o", "addr", "show", "dev", name],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=3,
        )

        fields = output.split()

        for index, field in enumerate(fields):
            if field == "inet" and index + 1 < len(fields):
                return fields[index + 1].split("/", 1)[0]

    except (
        subprocess.SubprocessError,
        OSError,
        ValueError,
    ):
        pass

    return ""


def list_interfaces():
    result = []

    for name in sorted(set(get_if_list())):
        address = ""

        try:
            address = get_if_addr(name) or ""
        except Exception:
            address = ""

        # Scapy can return 0.0.0.0 even when Linux has an IPv4 address.
        if not address or address == "0.0.0.0":
            address = get_linux_ipv4(name)

        try:
            mac = get_if_hwaddr(name) or ""
        except Exception:
            mac = ""

        result.append(
            {
                "name": name,
                "description": name,
                "address": address,
                "mac": mac,
            }
        )

    return result


@app.on_event("startup")
async def on_startup():
    global event_loop
    event_loop = asyncio.get_running_loop()


def stop_capture():
    global sniffer, last_error

    current = sniffer

    if current is not None:
        try:
            if current.running:
                current.stop(join=True)
        except Exception as exc:
            last_error = str(exc)
        finally:
            sniffer = None

    emit({"type": "sensor_status", "data": status()})
    return status()


@app.on_event("shutdown")
def on_shutdown():
    stop_capture()


@app.get("/health")
def health():
    return {"status": "ok", "sensor": status()}


@app.get("/interfaces")
def interfaces():
    return {"interfaces": list_interfaces()}


@app.get("/events")
def get_events(limit: int = Query(default=50, ge=1, le=500)):
    with lock:
        return {"events": list(events)[:limit]}


@app.post("/capture/start")
def start_capture(request: StartRequest):
    global sniffer
    global interface_name, bpf_filter, started_at, last_error

    available_interfaces = {
        item["name"] for item in list_interfaces()
    }

    if request.interface not in available_interfaces:
        raise HTTPException(
            status_code=400,
            detail="Unknown interface. Refresh the interface list.",
        )

    chosen_filter = request.bpf.strip() or "ip or arp"

    if (
        len(chosen_filter) > 256
        or any(c in chosen_filter for c in "\r\n\0")
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid BPF filter.",
        )

    stop_capture()

    interface_name = request.interface
    bpf_filter = chosen_filter
    started_at = now_iso()
    last_error = None

    try:
        candidate = AsyncSniffer(
            iface=interface_name,
            filter=bpf_filter,
            prn=handle_packet,
            store=False,
        )
        candidate.start()
        sniffer = candidate

    except Exception as exc:
        sniffer = None
        last_error = str(exc)

        raise HTTPException(
            status_code=500,
            detail=(
                f"Capture failed: {exc}. "
                "Check permissions, libpcap, interface and BPF filter."
            ),
        )

    snapshot = status()
    emit({"type": "sensor_status", "data": snapshot})

    return {"sensor": snapshot}


@app.post("/capture/stop")
def capture_stop(request: StopRequest):
    return {"sensor": stop_capture()}


@app.get("/events/stream")
async def event_stream():
    queue = asyncio.Queue(maxsize=100)
    subscribers.add(queue)

    async def generate():
        try:
            yield ": connected\n\n"

            while True:
                try:
                    message = await asyncio.wait_for(
                        queue.get(),
                        timeout=15,
                    )
                    yield "data: " + json.dumps(message) + "\n\n"

                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"

        finally:
            subscribers.discard(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

