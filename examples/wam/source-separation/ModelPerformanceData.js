// Reference machine: complete fixed 6s matrix, two fresh sessions per configuration.
// Raw measurements and visibility-control limitations: MODEL_COMPARISON.md.
export const REFERENCE_BENCHMARK = {
  "protocol": "slow-motion-dream-6s-v1",
  "date": "2026-10-23T05:40:11.907Z",
  "fixtureSha256": "4b431d535d235bd81b62f816f08c3f1afb6679d2706d84b3b75903b7df909507",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "isolated": true,
  "capabilities": {
    "webgpu": true,
    "message": "WebGPU disponible · compatibilité de chaque modèle à valider."
  },
  "runs": [
    {
      "modelId": "htdemucs_6s",
      "backend": "wasm",
      "trial": 0,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"57ae738153b5873c8b2fa1cfe291a38f3e08d2679ad83e7138adb2b5503bd03e\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 71832.40000009537,
      "preparationMs": 0.30500006675720215,
      "separationMs": 71832.09500002861,
      "firstReadyMs": 37910.72500002384
    },
    {
      "modelId": "htdemucs_4s_onnx",
      "backend": "webgpu",
      "trial": 0,
      "identity": "[\"45f990170d9571379a9dbd3bbdd1c7591b26864c\",[\"da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 12698.070000052452,
      "preparationMs": 0.14500010013580322,
      "separationMs": 12697.924999952316,
      "firstReadyMs": 12588.880000114441
    },
    {
      "modelId": "htdemucs_4s_onnx",
      "backend": "wasm",
      "trial": 0,
      "identity": "[\"45f990170d9571379a9dbd3bbdd1c7591b26864c\",[\"da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 49830.074999928474,
      "preparationMs": 0.12999999523162842,
      "separationMs": 49829.94499993324,
      "firstReadyMs": 49722.02499997616
    },
    {
      "modelId": "htdemucs_4s_preview",
      "backend": "webgpu",
      "trial": 0,
      "identity": "[\"short-2s-v1\",[\"a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 17579.65499997139,
      "preparationMs": 6723.259999990463,
      "separationMs": 10856.394999980927,
      "firstReadyMs": 8784.679999947548
    },
    {
      "modelId": "htdemucs_4s_preview",
      "backend": "wasm",
      "trial": 0,
      "identity": "[\"short-2s-v1\",[\"a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 61188.09500002861,
      "preparationMs": 14699.370000004768,
      "separationMs": 46488.72500002384,
      "firstReadyMs": 23955.289999961853
    },
    {
      "modelId": "bs_roformer_sw_6s",
      "backend": "webgpu",
      "trial": 0,
      "identity": "[\"a744f80957374e1735ad70fa122670b7961da8cc\",[\"d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 22966.53499996662,
      "preparationMs": 13905.375,
      "separationMs": 9061.159999966621,
      "firstReadyMs": 18443.75
    },
    {
      "modelId": "bs_roformer_sw_6s",
      "backend": "wasm",
      "trial": 0,
      "identity": "[\"a744f80957374e1735ad70fa122670b7961da8cc\",[\"d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 460441.3600000143,
      "preparationMs": 175852.05000007153,
      "separationMs": 284589.3099999428,
      "firstReadyMs": 318891.86500000954
    },
    {
      "modelId": "htdemucs_6s",
      "backend": "wasm",
      "trial": 1,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"57ae738153b5873c8b2fa1cfe291a38f3e08d2679ad83e7138adb2b5503bd03e\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 65901.35000002384,
      "preparationMs": 0.060000061988830566,
      "separationMs": 65901.28999996185,
      "firstReadyMs": 34781.96000003815
    },
    {
      "modelId": "htdemucs_4s_onnx",
      "backend": "webgpu",
      "trial": 1,
      "identity": "[\"45f990170d9571379a9dbd3bbdd1c7591b26864c\",[\"da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 10991.289999961853,
      "preparationMs": 0.09999990463256836,
      "separationMs": 10991.19000005722,
      "firstReadyMs": 10904.834999918938
    },
    {
      "modelId": "htdemucs_4s_onnx",
      "backend": "wasm",
      "trial": 1,
      "identity": "[\"45f990170d9571379a9dbd3bbdd1c7591b26864c\",[\"da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 47720.4699999094,
      "preparationMs": 0.18999993801116943,
      "separationMs": 47720.27999997139,
      "firstReadyMs": 47601.05499994755
    },
    {
      "modelId": "htdemucs_4s_preview",
      "backend": "webgpu",
      "trial": 1,
      "identity": "[\"short-2s-v1\",[\"a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 15847.850000023842,
      "preparationMs": 6003.850000023842,
      "separationMs": 9844,
      "firstReadyMs": 7989.915000081062
    },
    {
      "modelId": "htdemucs_4s_preview",
      "backend": "wasm",
      "trial": 1,
      "identity": "[\"short-2s-v1\",[\"a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 60108.5,
      "preparationMs": 14864.955000042915,
      "separationMs": 45243.544999957085,
      "firstReadyMs": 24021.125
    },
    {
      "modelId": "bs_roformer_sw_6s",
      "backend": "webgpu",
      "trial": 1,
      "identity": "[\"a744f80957374e1735ad70fa122670b7961da8cc\",[\"d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 21844.009999990463,
      "preparationMs": 13292.909999966621,
      "separationMs": 8551.100000023842,
      "firstReadyMs": 17720.15999996662
    },
    {
      "modelId": "bs_roformer_sw_6s",
      "backend": "wasm",
      "trial": 1,
      "identity": "[\"a744f80957374e1735ad70fa122670b7961da8cc\",[\"d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 424195.5199999809,
      "preparationMs": 149908.45999991894,
      "separationMs": 274287.060000062,
      "firstReadyMs": 287575.49000000954
    },
    {
      "modelId": "htdemucs_ft",
      "backend": "wasm",
      "trial": 0,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"224d5043faf8a900d6239e18515bbb0bed83ed3b5606a5b150f716bf32406964\",\"b8923e06a7ba021eac9ece46ca11e0f62586e95439444d3165cf7b11af10510c\",\"8e9d687904b803650715bf2d1006efa99c430af59c5d361c10faa9853cf54392\",\"02c096d83f17c1d09ffcfd1bbe560017ae46469b2666d58030cecb737b1f5fcf\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 342961.2650001049,
      "preparationMs": 0.21000003814697266,
      "separationMs": 342961.05500006676,
      "firstReadyMs": 342961.25999999046,
      "runtimeVersion": null
    },
    {
      "modelId": "htdemucs_ft",
      "backend": "wasm",
      "trial": 1,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"224d5043faf8a900d6239e18515bbb0bed83ed3b5606a5b150f716bf32406964\",\"b8923e06a7ba021eac9ece46ca11e0f62586e95439444d3165cf7b11af10510c\",\"8e9d687904b803650715bf2d1006efa99c430af59c5d361c10faa9853cf54392\",\"02c096d83f17c1d09ffcfd1bbe560017ae46469b2666d58030cecb737b1f5fcf\"]]",
      "frames": 264600,
      "status": "ok",
      "totalMs": 393460.4250000715,
      "preparationMs": 0.18500006198883057,
      "separationMs": 393460.24000000954,
      "firstReadyMs": 393460.3550000191,
      "runtimeVersion": null
    }
  ],
  "previousDate": "2026-10-23T05:16:18.262Z"
};
export const GUITAR_RANKING = {
 checked:'2026-10-23',source:'https://www.mvsep.com/quality_checker/leaderboard/guitar',
 note:'SDR guitare sur le jeu de test MVSep, plus haut = meilleur. Référence externe : aucun score ne certifie notre export navigateur ni ses fenêtres courtes. Ce ne sont pas des votes de guitaristes. Sélection de références, classement complet via le lien.',
 entries:[
  {name:'BS Roformer SW · UVR 5.6',score:9.012,rank:1,hostModel:'bs_roformer_sw_6s'},
  {name:'Demucs 6s',score:5.2489,hostModel:'htdemucs_6s',source:'https://www.mvsep.com/quality_checker/leaderboard/guitar?algo_name_filter=Demucs&sort=&ranking_metrics='},
  {name:'Logic Pro 11.2 · Apple',score:9.002,rank:3},
  {name:'MVSep Guitar Ensemble · 2024.09.14',score:7.5112,rank:14},
  {name:'BS-RoFormer · Guitar',score:7.1266,rank:19},
 ]
};
