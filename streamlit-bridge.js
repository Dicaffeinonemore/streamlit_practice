// Small local component handshake. Game scripts retain their original loading order.
(() => {
  'use strict';
  const send = (type, fields = {}) => window.parent.postMessage({isStreamlitMessage: true, type, ...fields}, '*');
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.type !== 'streamlit:render') return;
    send('streamlit:setFrameHeight', {height: event.data.args?.height || 680});
  });
  send('streamlit:componentReady', {apiVersion: 1});
})();
