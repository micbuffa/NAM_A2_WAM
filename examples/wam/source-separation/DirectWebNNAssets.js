// Pinned source checkpoint identities; no benchmark/ORT dependency in the native path.
export const EXPERIMENT_MODELS={demucs4:{sha256:'da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748'},roformer6:{sha256:'d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444'}};
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
