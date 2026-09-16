const actor = document.querySelector('#actor');
const notice = document.querySelector('#notice');

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', 'x-demo-user': actor.value, ...(options.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}

async function refresh() {
  const accounts = await api('/api/accounts');
  document.querySelector('#accounts').replaceChildren(...accounts.map(item => {
    const card = document.createElement('article');
    const title = document.createElement('strong');
    title.textContent = item.label;
    const balance = document.createElement('span');
    balance.textContent = ` ¥${item.balance.toLocaleString('ja-JP')}`;
    card.append(title, balance);
    return card;
  }));
}

async function submitJson(event, path) {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result = await api(path, { method: 'POST', body: JSON.stringify(input) });
    notice.textContent = `完了: ${JSON.stringify(result)}`;
    await refresh();
  } catch (error) { notice.textContent = `エラー: ${error.message}`; }
}

document.querySelector('#transfer').addEventListener('submit', event => submitJson(event, '/api/transfers'));
document.querySelector('#promotion').addEventListener('submit', event => submitJson(event, '/api/promotions/redeem'));
document.querySelector('#preview').addEventListener('submit', async event => {
  event.preventDefault();
  const result = await api('/api/messages/preview', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
  document.querySelector('#messagePreview').innerHTML = result.preview;
});
document.querySelector('#search').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const q = new URLSearchParams(new FormData(event.currentTarget));
    document.querySelector('#searchResult').textContent = JSON.stringify(await api(`/api/customers?${q}`), null, 2);
  } catch (error) { document.querySelector('#searchResult').textContent = error.message; }
});
actor.addEventListener('change', () => refresh().catch(error => notice.textContent = error.message));
refresh().catch(error => notice.textContent = error.message);
