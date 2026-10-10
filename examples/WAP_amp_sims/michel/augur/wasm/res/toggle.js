var Toggle = function (elem,root)
{
  var value = false;
  var self = this;
  var led = elem;
  var param;

  if (root) {
    var tmp = root.querySelector("#toggle");
    elem.appendChild(document.importNode(tmp.content, true));
    led = elem.querySelector(".led");
  }

  elem.onclick = function () {
    self.setValue(!value);
    if (param) param.setValue(value, self);
  }

  this.setValue = function (v) {
    value = v;
    if (v) led.classList.add("active");
    else led.classList.remove("active");
  }

  function setParam (v) {
    param = v;
    v.observe(self);
  }

  this.valueChanged = (p) => { this.value = p.scaledValue; }

  Object.defineProperties(this, {
    value: { set: (v) => { this.setValue(v); }},
    param: { set: (v) => { setParam(v); }}
  })
}

var Choice = function (elem)
{
  var param;
  var self = this;

  elem.onchange = function (e) {
    param.setValue(elem.selectedIndex, self);
  }

  function setValue (v) {
    elem.selectedIndex = v;
  }

  function setParam (v) {
    param = v;
    v.observe(self);
  }

  this.valueChanged = (p) => { this.value = p.scaledValue; }

  Object.defineProperties(this, {
    value: { set: (v) => { setValue(v); }},
    param: { set: (v) => { setParam(v); }}
  })
}
