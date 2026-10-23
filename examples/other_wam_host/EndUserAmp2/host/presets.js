// ────────────────────────────────────────────────────────────
//  presets.js  –  Factory presets (read-only)
//  To add a new factory preset, append an entry to the array.
// ────────────────────────────────────────────────────────────

export const FACTORY_PRESETS = [
    {
        "name": "Clean",
        "state": {
            "tuner": {
                "enabled": 0
            },
            "deathgate": {
                "/deathgate/DeadZone": -100,
                "/deathgate/NoiseGate": -120
            },
            "autoWah": {
                "/AUtoWahMB/Autowah_Level": 0.6200000047683716,
                "/AUtoWahMB/bypass": 1
            },
            "ts9": {
                "/TS9_OverdriveFaustGenerated/TubeScreamer/drive": 0.5,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/level": -4.599999904632568,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/tone": 400,
                "/TS9_OverdriveFaustGenerated/bypass": 1
            },
            "stonePhaser": {
                "/StonePhaserStereo/Bypass": 1,
                "/StonePhaserStereo/Color": 0,
                "/StonePhaserStereo/LFO": 0.6600000262260437,
                "/StonePhaserStereo/Feedback": 75,
                "/StonePhaserStereo/Lo-cut": 500,
                "/StonePhaserStereo/Mix": 50,
                "/StonePhaserStereo/Stereo_phase": 0
            },
            "chorus": {
                "/Chorus/bypass": 1,
                "/Chorus/chorus/delay": 0.019999999552965164,
                "/Chorus/chorus/depth": 0.019999999552965164,
                "/Chorus/chorus/freq": 3,
                "/Chorus/chorus/level": 0.5
            },
            "amp": {
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Amp_Model/Amp": 0,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Bass": 0.6600000262260437,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Middle": 0.3400000035762787,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Treble": 0.7200000286102295,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/tonestack_type/Model": 3,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Curve_k": 1,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Drive_gain": 4,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Level": -3,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Master_Volume": 1.2999999523162842,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Negative_gain": -0.4000000059604645,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Presence": 3.299999952316284,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Saturation_dry_wet": 1,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Mix": 0.6489999890327454,
                "/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Type": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Cabinet_Select": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Mix__Dry_Wet_": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Output__dB_": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Output/Level": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Input_Trim": -3.9599996566772457,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Gain": 2.5,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Output_Level": 6.070000171661377,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/NbStages": 3,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/GainPlacement": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Tightness_HP": 30,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Brightness_LP": 12000,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Interstage_Trim": -2,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Cathode_Sag": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Time__ms_": 50,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Amount": 0.06,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Offset__H2_": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Amount": -0.02,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_1_Tube": 3,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_2_Tube": 3,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_3_Tube": 3,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_4_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_5_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/bypass": 0
            },
            "pingpong": {
                "/PingPongDelayFaust/bypass": 1,
                "/PingPongDelayFaust/feedback": 0.25,
                "/PingPongDelayFaust/mix": 0.5,
                "/PingPongDelayFaust/time": 0.12999999523162842
            },
            "greyhole": {
                "/greyhole/bypass": 1,
                "/greyhole/damping": 0,
                "/greyhole/delayTime": 0.20000000298023224,
                "/greyhole/diffusion": 0.5,
                "/greyhole/feedback": 0.8999999761581421,
                "/greyhole/modDepth": 0.10000000149011612,
                "/greyhole/modFreq": 2,
                "/greyhole/size": 1
            }
        }
    },
    {
        "name": "Crunch",
        "state": {
            "tuner": {
                "enabled": 0
            },
            "deathgate": {
                "/deathgate/DeadZone": -100,
                "/deathgate/NoiseGate": -120
            },
            "autoWah": {
                "/AUtoWahMB/Autowah_Level": 0.6200000047683716,
                "/AUtoWahMB/bypass": 1
            },
            "ts9": {
                "/TS9_OverdriveFaustGenerated/TubeScreamer/drive": 0.5,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/level": -4.599999904632568,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/tone": 400,
                "/TS9_OverdriveFaustGenerated/bypass": 1
            },
            "stonePhaser": {
                "/StonePhaserStereo/Bypass": 1,
                "/StonePhaserStereo/Color": 0,
                "/StonePhaserStereo/LFO": 0.6600000262260437,
                "/StonePhaserStereo/Feedback": 75,
                "/StonePhaserStereo/Lo-cut": 500,
                "/StonePhaserStereo/Mix": 50,
                "/StonePhaserStereo/Stereo_phase": 0
            },
            "chorus": {
                "/Chorus/bypass": 1,
                "/Chorus/chorus/delay": 0.019999999552965164,
                "/Chorus/chorus/depth": 0.019999999552965164,
                "/Chorus/chorus/freq": 3,
                "/Chorus/chorus/level": 0.5
            },
            "amp": {
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Amp_Model/Amp": 0,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Bass": 0.6600000262260437,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Middle": 0.18000000715255737,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Treble": 0.6200000047683716,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/tonestack_type/Model": 1,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Curve_k": 1,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Drive_gain": 4,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Level": -3,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Master_Volume": 3.799999952316284,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Negative_gain": -0.4000000059604645,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Presence": -3.799999952316284,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Saturation_dry_wet": 1,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Mix": 0.6019999980926514,
                "/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Type": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Cabinet_Select": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Mix__Dry_Wet_": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Output__dB_": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Output/Level": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Input_Trim": 3.6000000000000014,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Gain": 1.2000000476837158,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Output_Level": 6.070000171661377,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/NbStages": 2,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/GainPlacement": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Tightness_HP": 70,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Brightness_LP": 10000,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Interstage_Trim": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Cathode_Sag": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Time__ms_": 40,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Amount": 0.12,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Offset__H2_": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Amount": -0.06,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_1_Tube": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_2_Tube": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_3_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_4_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_5_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/bypass": 0
            },
            "pingpong": {
                "/PingPongDelayFaust/bypass": 1,
                "/PingPongDelayFaust/feedback": 0.25,
                "/PingPongDelayFaust/mix": 0.5,
                "/PingPongDelayFaust/time": 0.12999999523162842
            },
            "greyhole": {
                "/greyhole/bypass": 1,
                "/greyhole/damping": 0,
                "/greyhole/delayTime": 0.20000000298023224,
                "/greyhole/diffusion": 0.5,
                "/greyhole/feedback": 0.8999999761581421,
                "/greyhole/modDepth": 0.10000000149011612,
                "/greyhole/modFreq": 2,
                "/greyhole/size": 1
            }
        }
    },
    {
        "name": "Disto / Hi gain",
        "state": {
            "tuner": {
                "enabled": 0
            },
            "deathgate": {
                "/deathgate/DeadZone": -100,
                "/deathgate/NoiseGate": -77.81300354003906
            },
            "autoWah": {
                "/AUtoWahMB/Autowah_Level": 0.6200000047683716,
                "/AUtoWahMB/bypass": 1
            },
            "ts9": {
                "/TS9_OverdriveFaustGenerated/TubeScreamer/drive": 0.5,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/level": -4.599999904632568,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/tone": 400,
                "/TS9_OverdriveFaustGenerated/bypass": 1
            },
            "stonePhaser": {
                "/StonePhaserStereo/Bypass": 1,
                "/StonePhaserStereo/Color": 0,
                "/StonePhaserStereo/LFO": 0.6600000262260437,
                "/StonePhaserStereo/Feedback": 75,
                "/StonePhaserStereo/Lo-cut": 500,
                "/StonePhaserStereo/Mix": 50,
                "/StonePhaserStereo/Stereo_phase": 0
            },
            "chorus": {
                "/Chorus/bypass": 1,
                "/Chorus/chorus/delay": 0.019999999552965164,
                "/Chorus/chorus/depth": 0.019999999552965164,
                "/Chorus/chorus/freq": 3,
                "/Chorus/chorus/level": 0.5
            },
            "amp": {
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Amp_Model/Amp": 0,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Bass": 0.5,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Middle": 0.3400000035762787,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Treble": 0.7200000286102295,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/tonestack_type/Model": 0,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Curve_k": 1,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Drive_gain": 4,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Level": -3,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Master_Volume": 1.399999976158142,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Negative_gain": -0.4000000059604645,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Presence": 0.4000000059604645,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Saturation_dry_wet": 1,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Mix": 0.6169999837875366,
                "/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Type": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Cabinet_Select": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Mix__Dry_Wet_": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Output__dB_": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Output/Level": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Input_Trim": -3.9599996566772457,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Gain": 6.300000190734863,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Output_Level": 6.070000171661377,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/NbStages": 5,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/GainPlacement": 4,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Tightness_HP": 90,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Brightness_LP": 9000,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Interstage_Trim": 3,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Cathode_Sag": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Time__ms_": 18,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Amount": 0.22,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Offset__H2_": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Amount": -0.15,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_1_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_2_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_3_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_4_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_5_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/bypass": 0
            },
            "pingpong": {
                "/PingPongDelayFaust/bypass": 1,
                "/PingPongDelayFaust/feedback": 0.25,
                "/PingPongDelayFaust/mix": 0.5,
                "/PingPongDelayFaust/time": 0.12999999523162842
            },
            "greyhole": {
                "/greyhole/bypass": 1,
                "/greyhole/damping": 0,
                "/greyhole/delayTime": 0.20000000298023224,
                "/greyhole/diffusion": 0.5,
                "/greyhole/feedback": 0.8999999761581421,
                "/greyhole/modDepth": 0.10000000149011612,
                "/greyhole/modFreq": 2,
                "/greyhole/size": 1
            }
        }
    },
    {
        "name": "Jazzy",
        "state": {
            "tuner": {
                "enabled": 0
            },
            "deathgate": {
                "/deathgate/DeadZone": -100,
                "/deathgate/NoiseGate": -120
            },
            "autoWah": {
                "/AUtoWahMB/Autowah_Level": 0.5,
                "/AUtoWahMB/bypass": 1
            },
            "ts9": {
                "/TS9_OverdriveFaustGenerated/TubeScreamer/drive": 0.5,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/level": -4.599999904632568,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/tone": 400,
                "/TS9_OverdriveFaustGenerated/bypass": 1
            },
            "stonePhaser": {
                "/StonePhaserStereo/Bypass": 1,
                "/StonePhaserStereo/Color": 0,
                "/StonePhaserStereo/LFO": 0.20000000298023224,
                "/StonePhaserStereo/Feedback": 75,
                "/StonePhaserStereo/Lo-cut": 500,
                "/StonePhaserStereo/Mix": 50,
                "/StonePhaserStereo/Stereo_phase": 0
            },
            "chorus": {
                "/Chorus/bypass": 1,
                "/Chorus/chorus/delay": 0.019999999552965164,
                "/Chorus/chorus/depth": 0.019999999552965164,
                "/Chorus/chorus/freq": 3,
                "/Chorus/chorus/level": 0.5
            },
            "amp": {
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Amp_Model/Amp": 0,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Bass": 0.6600000262260437,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Middle": 0.8199999928474426,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Treble": 0.800000011920929,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/tonestack_type/Model": 3,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Curve_k": 1,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Drive_gain": 4,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Level": -3,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Master_Volume": 1.2000000476837158,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Negative_gain": -0.4000000059604645,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Presence": 10.100000381469727,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Saturation_dry_wet": 1,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Mix": 0.7200000286102295,
                "/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Type": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Cabinet_Select": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Mix__Dry_Wet_": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Output__dB_": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Output/Level": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Input_Trim": -3.9599996566772457,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Gain": 3.4000000953674316,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Output_Level": 6.070000171661377,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/NbStages": 3,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/GainPlacement": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Tightness_HP": 40,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Brightness_LP": 11000,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Interstage_Trim": -3,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Cathode_Sag": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Time__ms_": 60,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Amount": 0.05,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Offset__H2_": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Amount": -0.02,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_1_Tube": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_2_Tube": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_3_Tube": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_4_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_5_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/bypass": 0
            },
            "pingpong": {
                "/PingPongDelayFaust/bypass": 1,
                "/PingPongDelayFaust/feedback": 0.5,
                "/PingPongDelayFaust/mix": 0.5,
                "/PingPongDelayFaust/time": 0.5
            },
            "greyhole": {
                "/greyhole/bypass": 1,
                "/greyhole/damping": 0,
                "/greyhole/delayTime": 0.20000000298023224,
                "/greyhole/diffusion": 0.5,
                "/greyhole/feedback": 0.8999999761581421,
                "/greyhole/modDepth": 0.10000000149011612,
                "/greyhole/modFreq": 2,
                "/greyhole/size": 1
            }
        }
    },
    {
        "name": "Jordan",
        "state": {
            "tuner": {
                "enabled": 0
            },
            "deathgate": {
                "/deathgate/NoiseGate": -77.81300354003906,
                "/deathgate/DeadZone": -100
            },
            "autoWah": {
                "/AUtoWahMB/Autowah_Level": 0.6200000047683716,
                "/AUtoWahMB/bypass": 1
            },
            "ts9": {
                "/TS9_OverdriveFaustGenerated/bypass": 0,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/drive": 1,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/tone": 1000,
                "/TS9_OverdriveFaustGenerated/TubeScreamer/level": 4
            },
            "stonePhaser": {
                "/StonePhaserStereo/Color": 0,
                "/StonePhaserStereo/Lo-cut": 500,
                "/StonePhaserStereo/Stereo_phase": 0,
                "/StonePhaserStereo/Mix": 50,
                "/StonePhaserStereo/Feedback": 75,
                "/StonePhaserStereo/Bypass": 1,
                "/StonePhaserStereo/LFO": 0.6600000262260437
            },
            "chorus": {
                "/Chorus/chorus/level": 0.5,
                "/Chorus/chorus/delay": 0.019999999552965164,
                "/Chorus/bypass": 1,
                "/Chorus/chorus/freq": 3,
                "/Chorus/chorus/depth": 0.019999999552965164
            },
            "amp": {
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Amp_Model/Amp": 0,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Presence": -1,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Middle": 0.47999998927116394,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_4_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Master_Volume": 2.9200000762939453,
                "/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Type": 1,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Bass": 0.3799999952316284,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Drive_gain": 4,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Output__dB_": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Mix__Dry_Wet_": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Output/Level": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_5_Tube": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Input_Trim": -10.079999828338622,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/NbStages": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/GainPlacement": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Tightness_HP": 50,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Brightness_LP": 10000,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Lab_Controls/Interstage_Trim": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Cathode_Sag": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Time__ms_": 30,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Sag_Amount": 0.10,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Offset__H2_": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Dynamics/Bias_Amount": -0.05,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Saturation_dry_wet": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Output_Level": 6.070000171661377,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Level": -3,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_3_Tube": 5,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_2_Tube": 5,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Negative_gain": -0.4000000059604645,
                "/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Mix": 0.18000000715255737,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Cabinet_Select": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Gain": 1.100000023841858,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Treble": 0.6800000071525574,
                "/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/tonestack_type/Model": 0,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/bypass": 0,
                "/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Tube_choices/Stage_1_Tube": 2,
                "/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Curve_k": 1,
                "/guitar_tube_amp_sim_100%_FAUST/Cabinet_Simulator/Bypass": 0
            },
            "pingpong": {
                "/PingPongDelayFaust/time": 0.12999999523162842,
                "/PingPongDelayFaust/mix": 0.5,
                "/PingPongDelayFaust/bypass": 1,
                "/PingPongDelayFaust/feedback": 0.25
            },
            "greyhole": {
                "/greyhole/diffusion": 0.2678999900817871,
                "/greyhole/modDepth": 0.17800000309944153,
                "/greyhole/bypass": 1,
                "/greyhole/damping": 0.023000000044703484,
                "/greyhole/feedback": 0.28999999165534973,
                "/greyhole/modFreq": 2,
                "/greyhole/size": 0.9021999835968018,
                "/greyhole/delayTime": 0.4650999903678894
            }
        }
    }
];
