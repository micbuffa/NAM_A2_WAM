# DeathGate components

- Gate DSP: Oleg Kapitonov, copyright 2018, GPL-3.0-or-later. The original copyright, license notice and editable DSP source are preserved in `deathgate.dsp`. License text: https://www.gnu.org/licenses/gpl-3.0.txt. Faust-generated code retains its embedded library authorship and licensing metadata. The WASM binary is unchanged by this integration.
- WAM module and GUI: Michel Buffa / Wimmics; GUI improvements by Quentin Beauchet, as credited by the descriptor.
- Bundled WAM SDK and ParamMgr: WebAudioModules 2.0 Working Group / Web Audio Modules, MIT. License copies and RingBuffer attribution are under `runtime/licenses/`. These runtime files are the versions already used by the Wasabi WAM amplifier port, with the ParamMgr destruction acknowledgement fix.
- WebAudioControls (GUI only): Eiji Kitamura, Ryoya Kawai, Keisuke Ai, g200kg / Tatsuya Shinyagaito, Apache-2.0. Their copyright and license notice remain in the controls source.

Integration changes: deferred GUI import, explicit initial state, awaited/idempotent destruction, GUI animation cleanup, worklet registration cache and Blob URL cleanup. No gate DSP recompilation or parameter renaming.
