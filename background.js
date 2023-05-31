chrome.commands.onCommand.addListener(function (command) {
  if (command == "search_selection_in_Google_1Foreground") {
    openSearchTab(baseURL_bef = "https://www.google.com/search?q=", baseURL_aft = "", f_Active = true);
  }
  else if (command == "search_selection_in_Google_2Background") {
    openSearchTab(baseURL_bef = "https://www.google.com/search?q=", baseURL_aft = "", f_Active = false);
  }
  else if (command == "search_selection_in_DefaultEngine_3NewTab") {
    openSearchTab_DefaultEngine("NEW_TAB");
  }
  else if (command == "search_selection_in_DefaultEngine_4NewWindow") {
    openSearchTab_DefaultEngine("NEW_WINDOW");
  }
  else if (command == "search_selection_in_DefaultEngine_5CurrentTab") {
    openSearchTab_DefaultEngine("CURRENT_TAB");
  }
  else if(command == "search_selection_in_DefaultEngine_6RightClickBehavior") {
    openSearchTab_RightClickBehaviour()
  }
});

function getCurrentTab(callback) {
  console.log("getCurrentTab", callback)
  chrome.tabs.query(
    { active: true, currentWindow: true },
    tabs => {
      const tab = tabs[0];
      console.log("getCurrentTab", "tabs", tabs, "tabId", tab.id);
      if (callback) {
        callback(tab);
      }
    }
  );
}

function getDOMSelectedText() {
  return decodeURI(encodeURI(
    document.selection ? document.selection.createRange().text
      : window.getSelection ? window.getSelection()
        : document.getSelection ? document.getSelection()
          : ""
  ));
}

function getPdfSelectedText() {
  // get PDF selected text in chrome internal plugin
  // refer to: https://stackoverflow.com/questions/61076303/how-can-i-get-selected-text-in-pdf-in-javascript
  return new Promise(resolve => {
    window.addEventListener('message', function onMessage(e) {
      if (e.origin === 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai' &&
        e.data && e.data.type === 'getSelectedTextReply') {
        window.removeEventListener('message', onMessage);
        resolve(e.data.selectedText);
      }
    });
    // runs code in page context to access postMessage of the embedded plugin
    const script = document.createElement('script');
    if (chrome.runtime.getManifest().manifest_version > 2) {
      script.src = chrome.runtime.getURL('query-pdf.js');
    } else {
      script.textContent = `(${() => {
        document.querySelector('embed').postMessage({ type: 'getSelectedText' }, '*');
      }})()`;
    }
    document.documentElement.appendChild(script);
    script.remove();
  });
}

function injection() {
  //console.log("injection")
  // get DOM selected text
  const domSelectionText = decodeURI(encodeURI(
    document.selection ? document.selection.createRange().text
      : window.getSelection ? window.getSelection()
        : document.getSelection ? document.getSelection()
          : ""
  ));
  //console.log("injection", "domSelectionText", domSelectionText);
  if (domSelectionText) {
    //console.log("injection", "return domSelectionText", domSelectionText);
    return new Promise(resolve => resolve(domSelectionText));
  }
  else if(document.querySelector('embed')){

    // get PDF selected text in chrome internal plugin
    // refer to: https://stackoverflow.com/questions/61076303/how-can-i-get-selected-text-in-pdf-in-javascript
    //console.log("PDFINJECTION")
    return new Promise(resolve => {
      window.addEventListener('message', function onMessage(e) {
        if (e.origin === 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai' &&
          e.data && e.data.type === 'getSelectedTextReply') {
          window.removeEventListener('message', onMessage);
          resolve(e.data.selectedText);
        }
      });
      // runs code in page context to access postMessage of the embedded plugin
      const script = document.createElement('script');
      if (chrome.runtime.getManifest().manifest_version > 2) {
        script.src = chrome.runtime.getURL('query-pdf.js');
      } else {
        script.textContent = `(${() => {
          document.querySelector('embed').postMessage({ type: 'getSelectedText' }, '*');
        }})()`;
      }
      document.documentElement.appendChild(script);
      script.remove();
    });

  }
  else{
    return "";
  }
}


function getSelectedText(tabId, callback) {
  console.log("getSelectedText", "tabId", tabId, "callback", callback);
  chrome.scripting.executeScript(
    {
      //target: { tabId, allFrames: true },
      target: { tabId, allFrames: false },
      func: injection,
    },
    injectionResults => {
      console.log("getSelectedText", "injectionaResults", injectionResults);
      const text = injectionResults[0].result;
      callback(text);
    }
  );
}

function openSearchTab(baseURL_bef, baseURL_aft = "", f_Active) {
  console.log("openSearchTab", baseURL_bef, baseURL_aft = "", f_Active)
  getCurrentTab(
    tab => getSelectedText(tab.id,
      text => {
        console.log("openSearchTab", "text", text);
        var searchURL = baseURL_bef + text + baseURL_aft;
        chrome.tabs.create({
          'url': searchURL,
          'active': f_Active
        });
      }
    )
  )
  return true;
}

function openSearchTab_DefaultEngine(disposition) {
  getCurrentTab(tab => getSelectedText(tab.id,
    text => {
      chrome.search.query({
        text,
        disposition
      })
    }));
  return true;
}

// This is the right click bevahiour on selected text
// If selected text is an URL(Go to <text>), it opens the URL in a new tab
// Else (Search <default search provider> for <text>), it searches for the text.
function openSearchTab_RightClickBehaviour() {
  getCurrentTab(tab => getSelectedText(tab.id,
    text => {
      console.log("opening search tab with right click behaviour", tab)
      
      let url = text;
      if(!isUrl(text)) {
        // TODO: Find a way to replace with default search provider
        url = "https://www.google.com/search?q=" + text;
      }

      chrome.tabs.create({
        url: url,
        active: true,
        index: tab.index + 1
      });
    }));
  return true;
}

// from: https://github.com/segmentio/is-url/blob/master/index.js
var protocolAndDomainRE = /^(?:\w+:)?\/\/(\S+)$/;
var localhostDomainRE = /^localhost[\:?\d]*(?:[^\:?\d]\S*)?$/
var nonLocalhostDomainRE = /^[^\s\.]+\.\S{2,}$/;
function isUrl(string){
  if (typeof string !== 'string') {
    return false;
  }

  var match = string.match(protocolAndDomainRE);
  if (!match) {
    return false;
  }

  var everythingAfterProtocol = match[1];
  if (!everythingAfterProtocol) {
    return false;
  }

  if (localhostDomainRE.test(everythingAfterProtocol) ||
      nonLocalhostDomainRE.test(everythingAfterProtocol)) {
    return true;
  }

  return false;
}