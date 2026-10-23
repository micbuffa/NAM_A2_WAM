/**
 * midi_controllers_factory_mappings.js
 * Default MIDI mappings for popular controllers.
 */

export const FACTORY_MIDI_MAPPINGS = {
    "Launch Control": {
        // Amp Controls (CC 21-28)
        "amp:/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Input_Trim":      { type: "cc", number: 21, channel: 9 },
        "amp:/guitar_tube_amp_sim_100%_FAUST/Preamp_v6/Preamp__Controls/Gain":  { type: "cc", number: 22, channel: 9 },
        "amp:/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Bass":                  { type: "cc", number: 23, channel: 9 },
        "amp:/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Middle":                { type: "cc", number: 24, channel: 9 },
        "amp:/guitar_tube_amp_sim_100%_FAUST/4_Tonestack/4_Tonestack/EQ/Treble":                { type: "cc", number: 25, channel: 9 },
        "amp:/guitar_tube_amp_sim_100%_FAUST/6_Reverb/Mix":                                     { type: "cc", number: 26, channel: 9 },
        "amp:/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Master_Volume":                        { type: "cc", number: 27, channel: 9 },
        "amp:/guitar_tube_amp_sim_100%_FAUST/5_Power_Amp/Presence":                             { type: "cc", number: 28, channel: 9 },

        // Presets (Notes 9-12)
        "preset:f:Clean":                                   { type: "note", number: 9,  channel: 9 },
        "preset:f:Crunch":                                  { type: "note", number: 10, channel: 9 },
        "preset:f:Disto / Hi gain":                         { type: "note", number: 11, channel: 9 },
        "preset:f:Jazzy":                                   { type: "note", number: 12, channel: 9 },

        // Plugins (Notes 25-28)
        "plugin:autoWah:/AUtoWahMB/bypass":                 { type: "note", number: 25, channel: 9 },
        "plugin:ts9:/TS9_OverdriveFaustGenerated/bypass":   { type: "note", number: 26, channel: 9 },
        "plugin:stonePhaser:/StonePhaserStereo/Bypass":     { type: "note", number: 27, channel: 9 },
        "plugin:pingpong:/PingPongDelayFaust/bypass":       { type: "note", number: 28, channel: 9 }
    }
};
