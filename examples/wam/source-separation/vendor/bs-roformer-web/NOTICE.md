FFT radix-2 from elicwhite/bs-roformer-web, MIT, revision c6047cd28c41f803339e9b8a5775a56932de7157.
Source: https://github.com/elicwhite/bs-roformer-web
Only the FFT primitive is vendored. RoformerDSP.js implements the STFT/reconstruction contract independently, including full Hermitian mirroring (do not zero the negative bin F; it mirrors bin F-2). The weights retain their separately documented provenance in MODEL_CANDIDATES.md.
