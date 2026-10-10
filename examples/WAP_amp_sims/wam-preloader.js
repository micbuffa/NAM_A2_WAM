pendingScripts = {};

WAM.WASABI_SC = {
  async init() {
    let origin = "http://127.0.0.1:8081/";
    //let origin = "https://amped-studio-content.s3.amazonaws.com/wams/wasabi/";

    function loadScript(url) {
      if (url.indexOf("http") != 0) url = origin + "michel/" + url;

      if (!pendingScripts[url]) {
        pendingScripts[url] = new Promise((resolve) => {
          let script = document.createElement("script");
          script.src = url;
          script.onload = (e) => {
            resolve();
          };

          document.head.appendChild(script);
        });
      }
      return pendingScripts[url];
    }

    // -- common files
    WAM.WASABI_SC.loadScript = loadScript;
    await loadScript("WebAudioSDK.js");
    await loadScript("webcomponents-lite.js");
    await loadScript("../wam-definitions.js");
    WAM.WASABI_SC.LOCAL.origin = origin;
  }
}
