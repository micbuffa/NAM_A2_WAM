// Real completed controlled pilot; protocol and limitations: INSTRUMENT_QUALITY.md.
export const REFERENCE_QUALITY = {
  "protocol": "guitar-bass-controlled-v1",
  "status": "completed",
  "date": "2026-10-23T12:58:01.816Z",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "cases": [
    {
      "id": "clean",
      "file": "CleanChords.mp3",
      "sourceSha256": "c47db7c8d34099bc1a9ea9d591204f0a14e21f6728223ae23c0852396044d420"
    },
    {
      "id": "acoustic",
      "file": "FolkAcousticDI.mp3",
      "sourceSha256": "03f78e241c48fe7eb2d7d2bae5ee2a17505e2c313d2f76a9a666f1de91ecc3cf"
    },
    {
      "id": "driven",
      "file": "ClassicRockRiff.mp3",
      "sourceSha256": "bc2d3783196375aa948758cff7792780e1543723da765b24149d38467404b6d9"
    }
  ],
  "runs": [
    {
      "caseId": "clean",
      "modelId": "htdemucs_6s",
      "backend": "wasm",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"57ae738153b5873c8b2fa1cfe291a38f3e08d2679ad83e7138adb2b5503bd03e\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 18.614511712535865,
          "snrDb": 18.64323054177393,
          "gainDb": -0.20481117363465337,
          "polarity": 1,
          "improvementDb": 19.939138113508637,
          "role": "guitar",
          "backing": {
            "valid": true,
            "siSdrDb": 17.64208439146432,
            "snrDb": 17.695084408329787,
            "gainDb": -0.06904095454109943,
            "polarity": 1,
            "improvementDb": 16.405883349260172
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 17.88693267576714,
          "snrDb": 17.842930317191172,
          "gainDb": -0.32279688731993267,
          "polarity": 1,
          "improvementDb": 20.348367784136503,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 18.66204861922658,
            "snrDb": 18.419663062345105,
            "gainDb": 0.14992161874831972,
            "polarity": 1,
            "improvementDb": 15.552782995713335
          }
        }
      }
    },
    {
      "caseId": "clean",
      "modelId": "htdemucs_ft",
      "backend": "wasm",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"224d5043faf8a900d6239e18515bbb0bed83ed3b5606a5b150f716bf32406964\",\"b8923e06a7ba021eac9ece46ca11e0f62586e95439444d3165cf7b11af10510c\",\"8e9d687904b803650715bf2d1006efa99c430af59c5d361c10faa9853cf54392\",\"02c096d83f17c1d09ffcfd1bbe560017ae46469b2666d58030cecb737b1f5fcf\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 19.519070415105677,
          "snrDb": 19.560370155243938,
          "gainDb": -0.1333003486553185,
          "polarity": 1,
          "improvementDb": 20.84369681607845,
          "role": "other",
          "backing": {
            "valid": true,
            "siSdrDb": 21.579777488368855,
            "snrDb": 21.604367334299152,
            "gainDb": -0.08596050538832618,
            "polarity": 1,
            "improvementDb": 20.343576446164708
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 18.954658016525162,
          "snrDb": 18.885147657889817,
          "gainDb": -0.2784330600331713,
          "polarity": 1,
          "improvementDb": 21.416093124894523,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 20.866657832548437,
            "snrDb": 20.898061442101547,
            "gainDb": -0.04695361610366251,
            "polarity": 1,
            "improvementDb": 17.757392209035192
          }
        }
      }
    },
    {
      "caseId": "clean",
      "modelId": "htdemucs_4s_onnx",
      "backend": "webgpu",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"45f990170d9571379a9dbd3bbdd1c7591b26864c\",[\"da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 20.50949940429236,
          "snrDb": 20.54779950966697,
          "gainDb": -0.08173595598893425,
          "polarity": 1,
          "improvementDb": 21.83412580526513,
          "role": "other",
          "backing": {
            "valid": true,
            "siSdrDb": 22.013335247047287,
            "snrDb": 22.04055091589286,
            "gainDb": -0.05582374882866388,
            "polarity": 1,
            "improvementDb": 20.77713420484314
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 18.99192548893064,
          "snrDb": 18.964743734797743,
          "gainDb": -0.24427270964259146,
          "polarity": 1,
          "improvementDb": 21.4533605973,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 21.63007152665199,
            "snrDb": 21.65039598329254,
            "gainDb": -0.02600275235614201,
            "polarity": 1,
            "improvementDb": 18.520805903138744
          }
        }
      }
    },
    {
      "caseId": "clean",
      "modelId": "htdemucs_4s_preview",
      "backend": "webgpu",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"short-2s-v1\",[\"a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 18.884205191789455,
          "snrDb": 18.92330173050617,
          "gainDb": -0.17309644948215208,
          "polarity": 1,
          "improvementDb": 20.208831592762227,
          "role": "other",
          "backing": {
            "valid": true,
            "siSdrDb": 20.289979143882896,
            "snrDb": 20.326774763191963,
            "gainDb": -0.056579693784110596,
            "polarity": 1,
            "improvementDb": 19.05377810167875
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 17.864982784773158,
          "snrDb": 17.931061455443967,
          "gainDb": -0.17609695798784783,
          "polarity": 1,
          "improvementDb": 20.32641789314252,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 20.583323841269134,
            "snrDb": 20.621104367600335,
            "gainDb": -0.0775775439324481,
            "polarity": 1,
            "improvementDb": 17.47405821775589
          }
        }
      }
    },
    {
      "caseId": "clean",
      "modelId": "bs_roformer_sw_6s",
      "backend": "webgpu",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"a744f80957374e1735ad70fa122670b7961da8cc\",[\"d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 23.53173854821246,
          "snrDb": 23.545800252566707,
          "gainDb": -0.018522889643482515,
          "polarity": 1,
          "improvementDb": 24.85636494918523,
          "role": "guitar",
          "backing": {
            "valid": true,
            "siSdrDb": 23.839618112853998,
            "snrDb": 23.821334433649184,
            "gainDb": -0.08702154834739352,
            "polarity": 1,
            "improvementDb": 22.60341707064985
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 22.104180929224736,
          "snrDb": 22.107826178765194,
          "gainDb": -0.10318789949924606,
          "polarity": 1,
          "improvementDb": 24.565616037594097,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 24.269049251740142,
            "snrDb": 24.278278483567235,
            "gainDb": -0.011140566182269543,
            "polarity": 1,
            "improvementDb": 21.159783628226897
          }
        }
      }
    },
    {
      "caseId": "acoustic",
      "modelId": "htdemucs_6s",
      "backend": "wasm",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"57ae738153b5873c8b2fa1cfe291a38f3e08d2679ad83e7138adb2b5503bd03e\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": -8.241985114663263,
          "snrDb": 0.5708196253586426,
          "gainDb": -20.023083690566118,
          "polarity": 1,
          "improvementDb": -6.999414744241345,
          "role": "guitar",
          "backing": {
            "valid": true,
            "siSdrDb": 1.9998136469205177,
            "snrDb": 1.9846815785570562,
            "gainDb": 0.015111272228645127,
            "polarity": 1,
            "improvementDb": 0.6965060983256137
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": -0.6499114520408931,
          "snrDb": -0.11376008190635639,
          "gainDb": -0.5522342900596038,
          "polarity": 1,
          "improvementDb": 1.6683993127985652,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": -0.8037091558474541,
            "snrDb": 2.6260838525584718,
            "gainDb": -6.723337623871442,
            "polarity": 1,
            "improvementDb": -3.97614965826413
          }
        }
      }
    },
    {
      "caseId": "acoustic",
      "modelId": "htdemucs_ft",
      "backend": "wasm",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"224d5043faf8a900d6239e18515bbb0bed83ed3b5606a5b150f716bf32406964\",\"b8923e06a7ba021eac9ece46ca11e0f62586e95439444d3165cf7b11af10510c\",\"8e9d687904b803650715bf2d1006efa99c430af59c5d361c10faa9853cf54392\",\"02c096d83f17c1d09ffcfd1bbe560017ae46469b2666d58030cecb737b1f5fcf\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 14.374890448662171,
          "snrDb": 14.460673488912754,
          "gainDb": -0.5257209804510949,
          "polarity": 1,
          "improvementDb": 15.61746081908409,
          "role": "other",
          "backing": {
            "valid": true,
            "siSdrDb": 18.268797277037454,
            "snrDb": 18.31523483260767,
            "gainDb": -0.06079609392926822,
            "polarity": 1,
            "improvementDb": 16.96548972844255
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 15.0350563550552,
          "snrDb": 15.161301447826144,
          "gainDb": -0.3341424168777831,
          "polarity": 1,
          "improvementDb": 17.35336711989466,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 15.689614793951087,
            "snrDb": 15.793310578591553,
            "gainDb": -0.3063677522290408,
            "polarity": 1,
            "improvementDb": 12.517174291534412
          }
        }
      }
    },
    {
      "caseId": "acoustic",
      "modelId": "htdemucs_4s_onnx",
      "backend": "webgpu",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"45f990170d9571379a9dbd3bbdd1c7591b26864c\",[\"da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 18.778324171350576,
          "snrDb": 18.803112438276298,
          "gainDb": -0.02827089412903779,
          "polarity": 1,
          "improvementDb": 20.020894541772496,
          "role": "other",
          "backing": {
            "valid": true,
            "siSdrDb": 20.247166411433962,
            "snrDb": 20.287943105399258,
            "gainDb": -0.07859622386015921,
            "polarity": 1,
            "improvementDb": 18.943858862839058
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 14.44318148979827,
          "snrDb": 14.511733860982547,
          "gainDb": -0.5411916141983734,
          "polarity": 1,
          "improvementDb": 16.76149225463773,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 17.327387396822804,
            "snrDb": 17.302230125337175,
            "gainDb": 0.02345130373296011,
            "polarity": 1,
            "improvementDb": 14.154946894406129
          }
        }
      }
    },
    {
      "caseId": "acoustic",
      "modelId": "htdemucs_4s_preview",
      "backend": "webgpu",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"short-2s-v1\",[\"a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 7.979908862792863,
          "snrDb": 8.333947980184874,
          "gainDb": -2.2412154324755322,
          "polarity": 1,
          "improvementDb": 9.222479233214782,
          "role": "other",
          "backing": {
            "valid": true,
            "siSdrDb": 9.822521437503122,
            "snrDb": 9.910973483387188,
            "gainDb": -0.09331296726908944,
            "polarity": 1,
            "improvementDb": 8.519213888908219
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 6.3648669510009945,
          "snrDb": 6.863160097364313,
          "gainDb": -0.5903127656222297,
          "polarity": 1,
          "improvementDb": 8.683177715840452,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 9.054395490665296,
            "snrDb": 9.49549988108311,
            "gainDb": -1.4108075016465549,
            "polarity": 1,
            "improvementDb": 5.881954988248621
          }
        }
      }
    },
    {
      "caseId": "acoustic",
      "modelId": "bs_roformer_sw_6s",
      "backend": "webgpu",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"a744f80957374e1735ad70fa122670b7961da8cc\",[\"d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 21.366846576816933,
          "snrDb": 21.39032917164457,
          "gainDb": -0.09530978665246476,
          "polarity": 1,
          "improvementDb": 22.609416947238852,
          "role": "guitar",
          "backing": {
            "valid": true,
            "siSdrDb": 22.251852524917272,
            "snrDb": 22.252761136027353,
            "gainDb": -0.10250658470996363,
            "polarity": 1,
            "improvementDb": 20.948544976322367
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 20.18971810626404,
          "snrDb": 20.190454079760617,
          "gainDb": -0.16554402890387498,
          "polarity": 1,
          "improvementDb": 22.508028871103498,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 22.270305602521834,
            "snrDb": 22.29540113084381,
            "gainDb": -0.059058113406802615,
            "polarity": 1,
            "improvementDb": 19.097865100105157
          }
        }
      }
    },
    {
      "caseId": "driven",
      "modelId": "htdemucs_6s",
      "backend": "wasm",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"57ae738153b5873c8b2fa1cfe291a38f3e08d2679ad83e7138adb2b5503bd03e\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 10.761763896044839,
          "snrDb": 11.10922844131833,
          "gainDb": -0.7601662138731904,
          "polarity": 1,
          "improvementDb": 12.09191017808959,
          "role": "guitar",
          "backing": {
            "valid": true,
            "siSdrDb": 12.415694948394247,
            "snrDb": 12.506137920478508,
            "gainDb": -0.10073833452749795,
            "polarity": 1,
            "improvementDb": 11.173311118027256
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 9.487945549122275,
          "snrDb": 9.780529091879677,
          "gainDb": -0.3618944260596175,
          "polarity": 1,
          "improvementDb": 11.72218019510482,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 12.21941399985197,
            "snrDb": 12.464588470017638,
            "gainDb": -0.4160985496416402,
            "polarity": 1,
            "improvementDb": 9.098690566606626
          }
        }
      }
    },
    {
      "caseId": "driven",
      "modelId": "htdemucs_ft",
      "backend": "wasm",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"35c8bd5b74c56f630082058179cd8f57cb192fb2\",[\"224d5043faf8a900d6239e18515bbb0bed83ed3b5606a5b150f716bf32406964\",\"b8923e06a7ba021eac9ece46ca11e0f62586e95439444d3165cf7b11af10510c\",\"8e9d687904b803650715bf2d1006efa99c430af59c5d361c10faa9853cf54392\",\"02c096d83f17c1d09ffcfd1bbe560017ae46469b2666d58030cecb737b1f5fcf\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 21.486745550086646,
          "snrDb": 21.516433703102305,
          "gainDb": -0.050127637613492225,
          "polarity": 1,
          "improvementDb": 22.816891832131397,
          "role": "other",
          "backing": {
            "valid": true,
            "siSdrDb": 23.338228354331015,
            "snrDb": 23.319885725142086,
            "gainDb": 0.01540310000080396,
            "polarity": 1,
            "improvementDb": 22.095844523964026
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 21.139964258353512,
          "snrDb": 21.170998932319073,
          "gainDb": -0.08387306683971564,
          "polarity": 1,
          "improvementDb": 23.374198904336055,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 22.66771541934431,
            "snrDb": 22.662669444079615,
            "gainDb": 0.004800889354085485,
            "polarity": 1,
            "improvementDb": 19.54699198609897
          }
        }
      }
    },
    {
      "caseId": "driven",
      "modelId": "htdemucs_4s_onnx",
      "backend": "webgpu",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"45f990170d9571379a9dbd3bbdd1c7591b26864c\",[\"da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 22.31371386771634,
          "snrDb": 22.337927968228428,
          "gainDb": -0.03976249825672879,
          "polarity": 1,
          "improvementDb": 23.643860149761093,
          "role": "other",
          "backing": {
            "valid": true,
            "siSdrDb": 23.77734349869165,
            "snrDb": 23.785574676993164,
            "gainDb": -0.00946227734671585,
            "polarity": 1,
            "improvementDb": 22.53495966832466
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 19.74899409033481,
          "snrDb": 19.72147219197025,
          "gainDb": -0.20897089644750882,
          "polarity": 1,
          "improvementDb": 21.983228736317358,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 22.310544339002718,
            "snrDb": 22.28302269818382,
            "gainDb": 0.022552957858651558,
            "polarity": 1,
            "improvementDb": 19.189820905757376
          }
        }
      }
    },
    {
      "caseId": "driven",
      "modelId": "htdemucs_4s_preview",
      "backend": "webgpu",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"short-2s-v1\",[\"a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 21.030637038738643,
          "snrDb": 21.064757372018107,
          "gainDb": -0.06828806442726905,
          "polarity": 1,
          "improvementDb": 22.360783320783394,
          "role": "other",
          "backing": {
            "valid": true,
            "siSdrDb": 22.468180352324314,
            "snrDb": 22.46951439143441,
            "gainDb": -0.0013526343267589824,
            "polarity": 1,
            "improvementDb": 21.22579652195732
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 19.314971860525024,
          "snrDb": 19.361772581628152,
          "gainDb": -0.07351574178392055,
          "polarity": 1,
          "improvementDb": 21.549206506507566,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 21.929519850136852,
            "snrDb": 21.93731226880772,
            "gainDb": -0.008431068105380935,
            "polarity": 1,
            "improvementDb": 18.80879641689151
          }
        }
      }
    },
    {
      "caseId": "driven",
      "modelId": "bs_roformer_sw_6s",
      "backend": "webgpu",
      "status": "ok",
      "frames": 264600,
      "identity": "[\"a744f80957374e1735ad70fa122670b7961da8cc\",[\"d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444\"]]",
      "scores": {
        "guitar": {
          "valid": true,
          "siSdrDb": 24.600272696364097,
          "snrDb": 24.606814488709716,
          "gainDb": -0.05271673664481929,
          "polarity": 1,
          "improvementDb": 25.93041897840885,
          "role": "guitar",
          "backing": {
            "valid": true,
            "siSdrDb": 25.604360622326073,
            "snrDb": 25.608359623697115,
            "gainDb": -0.04337071822521661,
            "polarity": 1,
            "improvementDb": 24.36197679195908
          }
        },
        "bass": {
          "valid": true,
          "siSdrDb": 23.321331841659475,
          "snrDb": 23.341254826906123,
          "gainDb": -0.04477760577498393,
          "polarity": 1,
          "improvementDb": 25.555566487642018,
          "role": "bass",
          "backing": {
            "valid": true,
            "siSdrDb": 24.52466113771362,
            "snrDb": 24.537232384126707,
            "gainDb": -0.043522535868988674,
            "polarity": 1,
            "improvementDb": 21.403937704468277
          }
        }
      }
    }
  ]
};
