var Param = function (id,name,min,max,def)
{
  this.id = id;
  this.name = name;
  this.scaledValue = def;

  var observers = [];
  var value = (def-min) / (max-min);

  this.observe = function (obs) {
    observers.push(obs);
  }

  this.unobserve = function (obs) {
    observers.splice(observers.indexOf(obs), 1);
  }

  this.setValue = function (v, sender) {
    if (v < min || v > max) return;
    this.scaledValue = v;

    // oh man, need to fix this:
    // pan knobs input value is bipolar, but param range is 0..1
    if (67 <= id && id < 75 && (!sender || sender.nodeName)) {
      value = 2 * (v + 63) / 126 - 1;
      observers.forEach((obs) => {
        if (obs.nodeName) obs._plug.setParam(id, value * 0.5 + 0.5);
        else obs.valueChanged(this);
      });
      return;
    }

    // oh man, need to fix this:
    // mixeg input value is bipolar, but param range is 0..1
    if (16 <= id && id <= 25) {
      // if (v < -1 || v > 1) v /= 63;
      if (sender && sender instanceof MixEG) v /= 63;
      if (sender && sender.nodeName) v /= 2;
      this.scaledValue = v;
      value = v * 0.5 + 0.5;
    }

    else value = (v-min) / (max-min);

    // -- LFO rates
    if (id == 52 || id == 54)
      value = 0.001 * Math.exp(Math.log(10/0.01) * value);

    // -- bipolar mod amounts
    /* else if (58 <= id && id < 61) {   //  && (sender && sender.nodeName)
      value *= 1.25;
      if (value > 1) value = 1;
      else if (value < -1) value = -1;
      // this.scaledValue = min + value * (max - min);
      // console.log(id, this.scaledValue, value);
    } */

    observers.forEach((obs) => {
      if (obs != sender) obs.valueChanged(this);
    });
  }

  Object.defineProperties(this, {
    value: { get: () => { return value; }}
  })
}
