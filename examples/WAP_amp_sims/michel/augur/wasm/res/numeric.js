var Numeric = function (elem, min,max,v)
{
  var value = v || 0;
  var acc = value;
  var prev = 0;
  var num;
  var param;
  var keyboardSupport = false;
  var self = this;
  this.elem = elem;
  this.scaler = 1;

  function startEditing () {
    if (!keyboardSupport) return;
    var range = document.createRange();
    range.selectNodeContents(num);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    num.onkeypress = onedit;
    num.contentEditable = true;
    num.focus();
    num.style.cursor = "text";
  }

  function endEditing () {
    num.onkeypress = null;
    num.contentEditable = false;
    num.style.cursor = "pointer";
  }

  function onedit (e) {
    var key = String.fromCharCode(e.which);
    if (isNaN(key) && key != '-') e.preventDefault();
  }

  function onmouse (e) {
    if (e.type == "mousedown") {
      prev = e.clientY;
      window.addEventListener("mousemove", onmouse, false);
      window.addEventListener("mouseup",   onmouse, false);
    }
    else if (e.type == "mousemove") {
      var delta = (prev - e.clientY) * self.scaler;
      if (delta == 0) return;
      setValue(acc + delta, true);
      prev = e.clientY;
    }
    else {
      window.removeEventListener("mousemove", onmouse, false);
      window.removeEventListener("mouseup",   onmouse, false);
    }
    e.stopPropagation();
  }

  function setValue (v, notify) {
    if (v < min) v = min;
    if (v > max) v = max;
    acc = v;
    if ((acc|0) != value) {
      value = acc|0;
      num.innerText = value;
      if (notify && param) param.setValue(value, self);
      else if (notify && self.oninput) self.oninput(value, self);
    }
  }

  this.valueChanged = (v) => { this.value = v.scaledValue; }

  Object.defineProperties(this, {
    value: { set: (v) => { setValue(v, false); }},
    param: { set: (v) => { param = v; param.observe(this); }}
  })

  function init () {
    num = elem; //.querySelector(".numeric");
    num.spellcheck = false;
    num.onmousedown = onmouse;
    num.ondblclick = startEditing;
    num.onblur = endEditing;
    num.innerText = value;
    if (max-min < 100)
      self.scaler = (max-min) / 100;
  }
  init();
}
