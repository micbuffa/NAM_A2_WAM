export function planChunks(totalFrames, chunkFrames, overlapFrames) {
  if (![totalFrames,chunkFrames,overlapFrames].every(Number.isSafeInteger) || totalFrames <= 0 || overlapFrames < 0 || chunkFrames <= overlapFrames) throw Error('Découpage invalide.');
  const chunks = [];
  for (let start = 0; start < totalFrames;) {
    const end = Math.min(totalFrames, start + chunkFrames), final = end === totalFrames;
    const commitFrames = final ? end - start : chunkFrames - overlapFrames;
    chunks.push({start,end,commitFrames,final}); start += commitFrames;
  }
  return chunks;
}

// Hold back the overlap until the next result is available. Never modify any
// samples already published to the audio thread.
export class OverlapAssembler {
  constructor(channels) { this.channels = channels; this.committedFrames = 0; this.tail = null; }
  push(plan, stems) {
    const length = plan.end - plan.start;
    if (plan.start !== this.committedFrames || stems.length !== this.channels || stems.some(c => !(c instanceof Float32Array) || c.length !== length || !c.every(Number.isFinite))) throw Error('Bloc audio désaligné.');
    const output = stems.map((channel,index) => {
      const copy = channel.slice();
      if (this.tail) {
        const previous = this.tail[index];
        if (previous.length > copy.length) throw Error('Recouvrement invalide.');
        for (let i=0;i<previous.length;i++) {
          const weight = previous.length === 1 ? 1 : i / (previous.length - 1);
          copy[i] = previous[i] * (1 - weight) + copy[i] * weight;
        }
      }
      return copy;
    });
    this.tail = plan.final ? null : output.map(c => c.slice(plan.commitFrames));
    const published = output.map(c => c.slice(0,plan.commitFrames));
    this.committedFrames += plan.commitFrames;
    return published;
  }
}
