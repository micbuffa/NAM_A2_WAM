// Measured browser outputs on known MUSDB train tracks. Diagnostic only.
export const REFERENCE_GUITAR_DIAGNOSTIC = {
  "protocol": "guitar-diagnostic-quality-v1",
  "status": "completed",
  "date": "2026-10-23T14:16:26.537Z",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "corpus": {
    "protocol": "guitar-diagnostic-corpus-v1",
    "purpose": "training-split-diagnostic",
    "sampleRate": 44100,
    "frames": 264600,
    "redistributeAudio": false,
    "trainingOverlap": "MUSDB train: known training-set membership, not independent validation",
    "sources": {
      "musdb": {
        "url": "https://github.com/sigsep/sigsep-mus-db/releases/download/v0.4.0/MUSDB18-7-STEMS.zip",
        "sha256": "365f66acffc57282e474a4c24b32afec3678258c50b8d45646ac849b0a287df3"
      },
      "licenses": {
        "url": "https://raw.githubusercontent.com/sigsep/website/master/content/datasets/assets/tracklist.csv",
        "sha256": "5e0a9252774412be23971ebfb7d384c0b2f29842eed2fa16aab69cf825b332b1"
      }
    },
    "cases": [
      {
        "id": "guitar-country",
        "dataset": "MUSDB18-7s / MedleyDB metadata",
        "track": "Music Delta - Country1",
        "group": "MusicDelta_Country1",
        "split": "train",
        "offsetSeconds": 0,
        "target": "guitar",
        "otherIsGuitar": true,
        "hasBleed": false,
        "style": "acoustic",
        "license": "CC BY-NC-SA",
        "genre": "Country",
        "sourceMember": "train/Music Delta - Country1.stem.mp4",
        "sourceSha256": "02187fa4dd9be3bf9d87b948210a20b1f9ef00011486374df566c29253bda6fc",
        "metadataSha256": "7c049a9d4fde92a57f888ae99b8da92e420764b3e670f6f82eb30d469a672b5c",
        "metadataURL": "https://raw.githubusercontent.com/marl/medleydb/master/medleydb/data/Metadata/MusicDelta_Country1_METADATA.yaml",
        "stemInstruments": [
          "drum set",
          "electric bass",
          "acoustic guitar",
          "acoustic guitar",
          "male singer"
        ],
        "referenceStream": 3,
        "trainingSetDiagnostic": true,
        "frames": 264600,
        "sampleRate": 44100,
        "commonGain": 1,
        "files": {
          "mix": {
            "path": "guitar-country/mix.wav",
            "sha256": "a1c3e1b84ebdd49e760be2b130a6bafbe55787c525a1ed120b7335ccb4ad8800"
          },
          "reference": {
            "path": "guitar-country/reference.wav",
            "sha256": "e3a894a5eac3c60459e8462b236951ccddad5053ba4da8de2eae1192908569f4"
          },
          "backing": {
            "path": "guitar-country/backing.wav",
            "sha256": "9dae2aef60d086e8362c87142ed85b194ac48b808a931a34d49b6e49a79fcfe6"
          }
        }
      },
      {
        "id": "guitar-grunge",
        "dataset": "MUSDB18-7s / MedleyDB metadata",
        "track": "Music Delta - Grunge",
        "group": "MusicDelta_Grunge",
        "split": "train",
        "offsetSeconds": 0,
        "target": "guitar",
        "otherIsGuitar": true,
        "hasBleed": false,
        "style": "distorted",
        "license": "CC BY-NC-SA",
        "genre": "Rock",
        "sourceMember": "train/Music Delta - Grunge.stem.mp4",
        "sourceSha256": "f5b64e67025fbcec4418b6bbb0634c75c4d61625f7544a4c2900f52db47fe23d",
        "metadataSha256": "fc0bc0524be54e030ae181d5c0faba5583596a0e9946314bad38ef83208f1a50",
        "metadataURL": "https://raw.githubusercontent.com/marl/medleydb/master/medleydb/data/Metadata/MusicDelta_Grunge_METADATA.yaml",
        "stemInstruments": [
          "drum set",
          "electric bass",
          "distorted electric guitar",
          "distorted electric guitar",
          "male singer"
        ],
        "referenceStream": 3,
        "trainingSetDiagnostic": true,
        "frames": 264600,
        "sampleRate": 44100,
        "commonGain": 1,
        "files": {
          "mix": {
            "path": "guitar-grunge/mix.wav",
            "sha256": "de53109c22eff8025524dac0ca20df106d894816b6864caf4063ff484f2dbf19"
          },
          "reference": {
            "path": "guitar-grunge/reference.wav",
            "sha256": "85ca5f2f57d825ac8f945a02431ea19c4b2814eb96bb424ca7497b8923412b70"
          },
          "backing": {
            "path": "guitar-grunge/backing.wav",
            "sha256": "235f4973f2b64aec569da846cb4c2c7e79c59aa6d7687abadc026f1b8c9f2566"
          }
        }
      },
      {
        "id": "guitar-meaxic",
        "dataset": "MUSDB18-7s / MedleyDB metadata",
        "track": "Meaxic - Take A Step",
        "group": "Meaxic_TakeAStep",
        "split": "train",
        "offsetSeconds": 0,
        "target": "guitar",
        "otherIsGuitar": true,
        "hasBleed": false,
        "style": "clean and distorted",
        "license": "CC BY-NC-SA",
        "genre": "Rock",
        "sourceMember": "train/Meaxic - Take A Step.stem.mp4",
        "sourceSha256": "d61db7686459fa4687645edede0c6c64aad3011d742464bf6330e53a79a489ff",
        "metadataSha256": "c20cc8af7b06a1378612c0682d6789157b260ada2e0298fa5f25ec5afbb64dd2",
        "metadataURL": "https://raw.githubusercontent.com/marl/medleydb/master/medleydb/data/Metadata/Meaxic_TakeAStep_METADATA.yaml",
        "stemInstruments": [
          "electric bass",
          "clean electric guitar",
          "distorted electric guitar",
          "male singer",
          "drum set",
          "vocalists",
          "vocalists",
          "vocalists"
        ],
        "referenceStream": 3,
        "trainingSetDiagnostic": true,
        "frames": 264600,
        "sampleRate": 44100,
        "commonGain": 1,
        "files": {
          "mix": {
            "path": "guitar-meaxic/mix.wav",
            "sha256": "518f17d0a1e88b96f8e20c5da8775363c5993522a621b3e759e4665c0000ffab"
          },
          "reference": {
            "path": "guitar-meaxic/reference.wav",
            "sha256": "9a6d4cf4910206d5c1191ab2411e1be45b95c83ae1cb9016f71c0b8f51c2b6bd"
          },
          "backing": {
            "path": "guitar-meaxic/backing.wav",
            "sha256": "3c4b2bc0c974f0a7338971f8ba8957586bd656b0e3bfe56046bbb9d63cd255e2"
          }
        }
      }
    ]
  },
  "resumedRows": 0,
  "resumedFromDate": null,
  "runs": [
    {
      "caseId": "guitar-country",
      "modelId": "htdemucs_6s",
      "backend": "wasm",
      "frames": 264600,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"57ae738153b5873c8b2fa1cfe291a38f3e08d2679ad83e7138adb2b5503bd03e\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 5.431414040016083,
        "snrDb": 6.439563001813998,
        "gainDb": -1.5557201165887082,
        "polarity": 1,
        "improvementDb": 15.282709997521927,
        "role": "guitar",
        "backing": {
          "valid": true,
          "siSdrDb": 15.592619857897436,
          "snrDb": 15.692743681768489,
          "gainDb": -0.3300547556239193,
          "polarity": 1,
          "improvementDb": 6.197707858184799
        }
      }
    },
    {
      "caseId": "guitar-country",
      "modelId": "htdemucs_4s_onnx",
      "backend": "webgpu",
      "frames": 264600,
      "identity": "[\"45f990170d9571379a9dbd3bbdd1c7591b26864c\",[\"da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 5.311879744986227,
        "snrDb": 6.330404767534875,
        "gainDb": -1.5435861825939217,
        "polarity": 1,
        "improvementDb": 15.16317570249207,
        "role": "other",
        "backing": {
          "valid": true,
          "siSdrDb": 15.6070381064243,
          "snrDb": 15.68872976648394,
          "gainDb": -0.36824665390034156,
          "polarity": 1,
          "improvementDb": 6.212126106711663
        }
      }
    },
    {
      "caseId": "guitar-country",
      "modelId": "htdemucs_4s_preview",
      "backend": "webgpu",
      "frames": 264600,
      "identity": "[\"short-2s-v1\",[\"a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 5.318365293384839,
        "snrDb": 6.4108469576161795,
        "gainDb": -1.877451581802323,
        "polarity": 1,
        "improvementDb": 15.169661250890684,
        "role": "other",
        "backing": {
          "valid": true,
          "siSdrDb": 15.682649460833026,
          "snrDb": 15.785637773119454,
          "gainDb": -0.3095685774644347,
          "polarity": 1,
          "improvementDb": 6.28773746112039
        }
      }
    },
    {
      "caseId": "guitar-country",
      "modelId": "bs_roformer_sw_6s",
      "backend": "webgpu",
      "frames": 264600,
      "identity": "[\"a744f80957374e1735ad70fa122670b7961da8cc\",[\"d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 8.87694673123655,
        "snrDb": 9.404815993167283,
        "gainDb": -1.0097080612222222,
        "polarity": 1,
        "improvementDb": 18.728242688742395,
        "role": "guitar",
        "backing": {
          "valid": true,
          "siSdrDb": 18.82447317544798,
          "snrDb": 18.853584384096575,
          "gainDb": -0.19266729076473352,
          "polarity": 1,
          "improvementDb": 9.429561175735344
        }
      }
    },
    {
      "caseId": "guitar-grunge",
      "modelId": "htdemucs_6s",
      "backend": "wasm",
      "frames": 264600,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"57ae738153b5873c8b2fa1cfe291a38f3e08d2679ad83e7138adb2b5503bd03e\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 3.5566945912287857,
        "snrDb": 4.9678641179018594,
        "gainDb": -2.0750187200283774,
        "polarity": 1,
        "improvementDb": 10.672345959418518,
        "role": "guitar",
        "backing": {
          "valid": true,
          "siSdrDb": 11.52813329913492,
          "snrDb": 11.802936930063527,
          "gainDb": -0.7499515757909361,
          "polarity": 1,
          "improvementDb": 4.522155684523489
        }
      }
    },
    {
      "caseId": "guitar-grunge",
      "modelId": "htdemucs_4s_onnx",
      "backend": "webgpu",
      "frames": 264600,
      "identity": "[\"45f990170d9571379a9dbd3bbdd1c7591b26864c\",[\"da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 4.469808375351666,
        "snrDb": 5.76069538536233,
        "gainDb": -2.1932651057550134,
        "polarity": 1,
        "improvementDb": 11.585459743541398,
        "role": "other",
        "backing": {
          "valid": true,
          "siSdrDb": 12.574989481110892,
          "snrDb": 12.80519969363784,
          "gainDb": -0.5248885807937207,
          "polarity": 1,
          "improvementDb": 5.569011866499461
        }
      }
    },
    {
      "caseId": "guitar-grunge",
      "modelId": "htdemucs_4s_preview",
      "backend": "webgpu",
      "frames": 264600,
      "identity": "[\"short-2s-v1\",[\"a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 4.235482399690618,
        "snrDb": 5.602546627005517,
        "gainDb": -2.402495682933472,
        "polarity": 1,
        "improvementDb": 11.351133767880349,
        "role": "other",
        "backing": {
          "valid": true,
          "siSdrDb": 12.382347201420739,
          "snrDb": 12.624974296179705,
          "gainDb": -0.5243682512775314,
          "polarity": 1,
          "improvementDb": 5.376369586809308
        }
      }
    },
    {
      "caseId": "guitar-grunge",
      "modelId": "bs_roformer_sw_6s",
      "backend": "webgpu",
      "frames": 264600,
      "identity": "[\"a744f80957374e1735ad70fa122670b7961da8cc\",[\"d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 6.908730908164486,
        "snrDb": 7.7130082413197565,
        "gainDb": -1.674453330930734,
        "polarity": 1,
        "improvementDb": 14.024382276354217,
        "role": "guitar",
        "backing": {
          "valid": true,
          "siSdrDb": 14.59444525397782,
          "snrDb": 14.742662774081591,
          "gainDb": -0.29514542664624144,
          "polarity": 1,
          "improvementDb": 7.58846763936639
        }
      }
    },
    {
      "caseId": "guitar-meaxic",
      "modelId": "htdemucs_6s",
      "backend": "wasm",
      "frames": 264600,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"57ae738153b5873c8b2fa1cfe291a38f3e08d2679ad83e7138adb2b5503bd03e\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 0.6620892631189091,
        "snrDb": 3.2649042403369832,
        "gainDb": -4.296332077401165,
        "polarity": 1,
        "improvementDb": 12.770348794478961,
        "role": "guitar",
        "backing": {
          "valid": true,
          "siSdrDb": 14.247581130635975,
          "snrDb": 14.383009577690816,
          "gainDb": -0.4492846414308066,
          "polarity": 1,
          "improvementDb": 2.7673053179014353
        }
      }
    },
    {
      "caseId": "guitar-meaxic",
      "modelId": "htdemucs_4s_onnx",
      "backend": "webgpu",
      "frames": 264600,
      "identity": "[\"45f990170d9571379a9dbd3bbdd1c7591b26864c\",[\"da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 0.012929381556871119,
        "snrDb": 2.8024298912576455,
        "gainDb": -4.247856215622457,
        "polarity": 1,
        "improvementDb": 12.121188912916923,
        "role": "other",
        "backing": {
          "valid": true,
          "siSdrDb": 14.035520326559737,
          "snrDb": 14.201726572121194,
          "gainDb": -0.37333168420252427,
          "polarity": 1,
          "improvementDb": 2.5552445138251976
        }
      }
    },
    {
      "caseId": "guitar-meaxic",
      "modelId": "htdemucs_4s_preview",
      "backend": "webgpu",
      "frames": 264600,
      "identity": "[\"short-2s-v1\",[\"a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 0.4137401518820526,
        "snrDb": 3.190070113924844,
        "gainDb": -4.931932939315606,
        "polarity": 1,
        "improvementDb": 12.521999683242104,
        "role": "other",
        "backing": {
          "valid": true,
          "siSdrDb": 14.430991734177862,
          "snrDb": 14.584729500052534,
          "gainDb": -0.3010956613901128,
          "polarity": 1,
          "improvementDb": 2.9507159214433223
        }
      }
    },
    {
      "caseId": "guitar-meaxic",
      "modelId": "bs_roformer_sw_6s",
      "backend": "webgpu",
      "frames": 264600,
      "identity": "[\"a744f80957374e1735ad70fa122670b7961da8cc\",[\"d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444\"]]",
      "status": "ok",
      "score": {
        "valid": true,
        "siSdrDb": 2.643488061295703,
        "snrDb": 4.494609712153024,
        "gainDb": -4.374360648404756,
        "polarity": 1,
        "improvementDb": 14.751747592655754,
        "role": "guitar",
        "backing": {
          "valid": true,
          "siSdrDb": 15.869878877950008,
          "snrDb": 15.980769311891589,
          "gainDb": -0.22822170329667799,
          "polarity": 1,
          "improvementDb": 4.389603065215468
        }
      }
    }
  ]
};
