import type { SignalingChannel } from './signaling.js';

const CHUNK_SIZE = 16 * 1024;
const BACKPRESSURE_HIGH = 4 * 1024 * 1024;
const BACKPRESSURE_LOW = 1 * 1024 * 1024;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** Progress payload emitted while a file moves across the DataChannel. */
export interface TransferProgress {
  bytesTransferred: number;
  bytesTotal: number;
}

/** Transfer header — the first JSON frame mobile sends before the chunks. */
interface TransferHeader {
  type: 'header';
  name: string;
  size: number;
  mime: string;
}

/** Desktop side: waits for the mobile peer to connect, then receives a file. */
export function receiveFile(
  signaling: SignalingChannel,
  onProgress?: (p: TransferProgress) => void,
): Promise<File> {
  return new Promise((resolvePromise, rejectPromise) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const dc = pc.createDataChannel('file', { ordered: true });
    wirePeerIce(pc, signaling);
    wireSignalingIntoPeer(pc, signaling, rejectPromise);

    signaling.onMessage(async (msg) => {
      if (msg.type === 'peer-joined') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signaling.send({ type: 'offer', sdp: offer });
      }
    });

    let header: TransferHeader | null = null;
    const chunks: ArrayBuffer[] = [];
    let received = 0;

    dc.binaryType = 'arraybuffer';
    dc.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        header = JSON.parse(event.data) as TransferHeader;
        return;
      }
      const buf = event.data as ArrayBuffer;
      chunks.push(buf);
      received += buf.byteLength;
      if (header) onProgress?.({ bytesTransferred: received, bytesTotal: header.size });
      if (header && received >= header.size) {
        const blob = new Blob(chunks, { type: header.mime });
        const file = new File([blob], header.name, { type: header.mime });
        resolvePromise(file);
        dc.close();
        pc.close();
      }
    });
  });
}

/** Mobile side: connects to a session, accepts the offer, sends the file. */
export async function sendFile(
  signaling: SignalingChannel,
  file: File,
  onProgress?: (p: TransferProgress) => void,
): Promise<void> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  wirePeerIce(pc, signaling);

  const dataChannel = new Promise<RTCDataChannel>((resolveDc) => {
    pc.addEventListener('datachannel', (event) => resolveDc(event.channel));
  });

  const rejecter = { fn: (_e: Error) => {} };
  wireSignalingIntoPeer(pc, signaling, (e) => rejecter.fn(e));

  const offered = new Promise<void>((resolveOffer, rejectOffer) => {
    rejecter.fn = rejectOffer;
    signaling.onMessage(async (msg) => {
      if (msg.type === 'offer') {
        await pc.setRemoteDescription(msg.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signaling.send({ type: 'answer', sdp: answer });
        resolveOffer();
      }
    });
  });
  await offered;

  const dc = await dataChannel;
  dc.binaryType = 'arraybuffer';
  await new Promise<void>((r) => {
    if (dc.readyState === 'open') r();
    else dc.addEventListener('open', () => r(), { once: true });
  });

  const header: TransferHeader = {
    type: 'header',
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
  };
  dc.send(JSON.stringify(header));

  const reader = file.stream().getReader();
  let sent = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (let i = 0; i < value.byteLength; i += CHUNK_SIZE) {
        const slice = value.subarray(i, i + CHUNK_SIZE);
        while (dc.bufferedAmount > BACKPRESSURE_HIGH) {
          await waitForBufferLow(dc);
        }
        dc.send(slice);
        sent += slice.byteLength;
        onProgress?.({ bytesTransferred: sent, bytesTotal: file.size });
      }
    }
  } finally {
    reader.releaseLock();
  }

  await new Promise<void>((r) => setTimeout(r, 500));
  dc.close();
  pc.close();
}

function wirePeerIce(pc: RTCPeerConnection, signaling: SignalingChannel): void {
  pc.addEventListener('icecandidate', (event) => {
    if (event.candidate) signaling.send({ type: 'ice', candidate: event.candidate.toJSON() });
  });
}

function wireSignalingIntoPeer(
  pc: RTCPeerConnection,
  signaling: SignalingChannel,
  reject: (err: Error) => void,
): void {
  signaling.onMessage(async (msg) => {
    try {
      if (msg.type === 'answer') await pc.setRemoteDescription(msg.sdp);
      else if (msg.type === 'ice') await pc.addIceCandidate(msg.candidate);
      else if (msg.type === 'peer-left') reject(new Error('peer disconnected'));
    } catch (err) {
      reject(err as Error);
    }
  });
}

function waitForBufferLow(dc: RTCDataChannel): Promise<void> {
  return new Promise((resolveBuf) => {
    const onLow = () => {
      dc.removeEventListener('bufferedamountlow', onLow);
      resolveBuf();
    };
    dc.bufferedAmountLowThreshold = BACKPRESSURE_LOW;
    dc.addEventListener('bufferedamountlow', onLow);
  });
}
