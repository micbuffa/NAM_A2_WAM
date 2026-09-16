
import("stdfaust.lib");
import ("effect.lib");

// Parameter to control the intensity of the autowah effect
level = hslider("Autowah Level [style:knob]", 0.5, 0, 1, 0.01); // Level from 0 (no effect) to 1 (full effect)

// Apply the autowah effect
autowah_effect = autowah(level);

// Stereo processing (mono input to stereo output)
process1 = _ : autowah_effect <: _,_; // Mono to stereo processing


// Ensure that the bypass block handles stereo correctly
process = ba.bypass_fade(ma.SR/10, checkbox("bypass"), process1:>_,_);