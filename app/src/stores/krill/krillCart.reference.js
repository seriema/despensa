/**
 * REFERENCE ONLY – not imported by the app yet.
 * Proof-of-concept Krill cart client, verified 2026-11-17 by running it inside a page on
 * lojasredekrill.com.br (it reads tokens from cookies there). Port to TypeScript in src/krill/
 * with tokens supplied by the app (see docs/KRILL_API.md → Tokens).
 * Quantities sent to atualizar_item are ABSOLUTE (set, not add).
 */
window.krillCart = (() => {
  const API = 'https://services.vipcommerce.com.br/api-admin/v1/org/216/';
  const cfg = { filial: 1, cd: 20, domain: 'lojasredekrill.com.br', org: '216' };
  const cookie = (n) => { const m = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(n + '=')); return m ? decodeURIComponent(m.slice(n.length + 1)) : null; };
  // Customer token is required for the cart; vip-token (store token) only works for catalogue calls.
  const headers = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', DomainKey: cfg.domain, OrganizationId: cfg.org,
    'sessao-id': cookie('sessao-id') || '', Authorization: 'Bearer ' + (cookie('cliente-token') || cookie('vip-token') || '') });
  const cdPath = () => `filial/${cfg.filial}/centro_distribuicao/${cfg.cd}/loja/`;
  async function call(path, { method = 'GET', body } = {}) {
    const r = await fetch(API + path, { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (r.status === 401) throw Object.assign(new Error('UNAUTHORIZED: session expired, re-login needed'), { status: 401, body: j });
    return { status: r.status, ok: r.ok && j && j.success !== false, data: j && j.data, error: j && j.error && (j.error.message || j.error) };
  }
  const num = (v) => v == null ? null : Number(v);
  const unitPrice = (it) => num(it.oferta && it.oferta.preco_oferta != null ? it.oferta.preco_oferta : it.preco);
  async function getCart() {
    const r = await call(cdPath() + 'carrinhos');
    if (!r.ok) throw new Error('getCart failed: ' + r.status + ' ' + r.error);
    const d = r.data;
    if (!d) return { carrinhoId: null, items: [], total: 0, units: 0, valorMinimo: null };
    return { carrinhoId: d.carrinho_id, cd: d.centro_distribuicao_id, total: num(d.preco), units: d.quantidade,
      valorMinimo: num(d.valor_minimo), pesoTotal: num(d.peso_total), quantidadeLimite: d.quantidade_limite,
      items: (d.itens || []).map(it => ({ produtoId: it.produto_id, itemId: it.item_id, descricao: it.descricao, qty: num(it.quantidade),
        unitPrice: unitPrice(it), listPrice: num(it.preco), emOferta: !!it.em_oferta, qtyMax: num(it.quantidade_maxima), unidade: it.unidade_sigla })) };
  }
  async function getProduct(produtoId) {
    const r = await call(cdPath() + `produtos/${produtoId}/detalhes`);
    if (!r.ok || !r.data) return null;
    const p = r.data.produto || r.data;
    return { produtoId: p.produto_id, descricao: p.descricao, disponivel: !!p.disponivel, preco: num(p.preco),
      precoOferta: p.em_oferta && p.oferta ? num(p.oferta.preco_oferta) : null, emOferta: !!p.em_oferta,
      qtyMin: num(p.quantidade_minima), qtyMax: num(p.quantidade_maxima), unidade: p.unidade_sigla, sku: p.sku, ean: p.codigo_barras };
  }
  async function search(term, page = 1) {
    const r = await call(cdPath() + `buscas/produtos/termo/${encodeURIComponent(term)}?page=${page}`);
    if (!r.ok) return [];
    return ((r.data && r.data.produtos) || []).map(p => ({ produtoId: p.produto_id, descricao: p.descricao, preco: num(p.preco),
      precoOferta: p.em_oferta && p.oferta ? num(p.oferta.preco_oferta) : null, disponivel: !!p.disponivel, qtyMax: num(p.quantidade_maxima) }));
  }
  async function setQty(produtoId, qty) {   // absolute quantity
    if (qty <= 0) return removeItem(produtoId);
    const cart = await getCart();
    const line = cart.items.find(i => i.produtoId === produtoId);
    const r = await call(cdPath() + 'carrinhos/atualizar_item/omnichannel', { method: 'POST',
      body: { mercadoria_id: produtoId, quantidade: qty, observacao: '', tipo: 1, item_id: line ? line.itemId : produtoId } });
    return { ok: r.ok, status: r.status, error: r.error || null };
  }
  async function addItem(produtoId, qty = 1) {   // increment
    const cart = await getCart();
    const line = cart.items.find(i => i.produtoId === produtoId);
    return setQty(produtoId, (line ? line.qty : 0) + qty);
  }
  async function removeItem(produtoId) {
    const cart = await getCart();
    const line = cart.items.find(i => i.produtoId === produtoId);
    if (!line) return { ok: true, status: 200, note: 'not in cart' };
    const r = await call(cdPath() + `carrinhos/remover_item/${line.itemId}`, { method: 'DELETE' });
    return { ok: r.ok, status: r.status, error: r.error || null };
  }
  async function clearCart() {
    const cart = await getCart(); const out = [];
    for (const it of cart.items) { const r = await call(cdPath() + `carrinhos/remover_item/${it.itemId}`, { method: 'DELETE' }); out.push({ produtoId: it.produtoId, ok: r.ok }); }
    return out;
  }
  async function restoreCart(snap) {   // snap = earlier getCart() result
    const cur = await getCart();
    for (const it of cur.items) { const s = snap.items.find(x => x.produtoId === it.produtoId);
      if (!s) await removeItem(it.produtoId); else if (s.qty !== it.qty) await setQty(it.produtoId, s.qty); }
    for (const s of snap.items) if (!cur.items.find(x => x.produtoId === s.produtoId)) await setQty(s.produtoId, s.qty);
    return getCart();
  }
  async function getDeliveryAddress() {
    const r = await call(`filial/${cfg.filial}/loja/clientes/enderecos/getEnderecosEntrega`);
    const list = (r.ok && r.data) || [];
    return list.find(e => e.principal) || list[0] || null;
  }
  async function getShipping(cart) {   // effective fee = frete - desconto
    cart = cart || await getCart();
    const end = await getDeliveryAddress();
    if (!end) return { error: 'no delivery address' };
    const r = await call(cdPath() + `compras/checkout/calcular_frete/endereco/${end.id}/total_itens/${cart.units || 0}?peso_itens=${cart.pesoTotal || 0}&tipo_cliente=AM`);
    const tipos = ((r.ok && r.data) || []).map(t => ({ id: t.id, descricao: t.descricao, homeDelivery: !t.retirada_loja, frete: num(t.frete),
      desconto: num(t.desconto), freteEfetivo: Math.max(0, num(t.frete) - num(t.desconto || 0)),
      slots: (t.horarios_formatados || []).map(h => ({ key: h.key, label: h.labelMobile || h.label })) }));
    const home = tipos.find(t => t.homeDelivery) || null;
    return { enderecoId: end.id, endereco: end.endereco_formatado, cep: end.cep, home, tipos };
  }
  // list: [{produtoId, qty, expectedPrice?}]; mode 'set' | 'add'
  async function fillCartFromList(list, { mode = 'set', clampToStock = true } = {}) {
    const report = { added: [], unavailable: [], partial: [], failed: [], priceChanges: [], total: null, frete: null, valorMinimo: null, belowMinimum: null };
    for (const want of list) {
      const p = await getProduct(want.produtoId);
      if (!p) { report.failed.push({ produtoId: want.produtoId, reason: 'product not found' }); continue; }
      if (!p.disponivel || !(p.qtyMax > 0)) { report.unavailable.push({ produtoId: p.produtoId, descricao: p.descricao, reason: 'disponivel=false / quantidade_maxima=0' }); continue; }
      const cart = await getCart();
      const line = cart.items.find(i => i.produtoId === want.produtoId);
      let target = mode === 'add' ? (line ? line.qty : 0) + want.qty : want.qty;
      if (target < (p.qtyMin || 1)) target = p.qtyMin || 1;
      if (target > p.qtyMax) {
        if (!clampToStock) { report.unavailable.push({ produtoId: p.produtoId, descricao: p.descricao, reason: `only ${p.qtyMax} available` }); continue; }
        report.partial.push({ produtoId: p.produtoId, descricao: p.descricao, requested: target, set: p.qtyMax }); target = p.qtyMax;
      }
      const r = await setQty(want.produtoId, target);
      if (r.ok) report.added.push({ produtoId: p.produtoId, descricao: p.descricao, qty: target });
      else if (/indispon/i.test(r.error || '')) report.unavailable.push({ produtoId: p.produtoId, descricao: p.descricao, reason: r.error });
      else report.failed.push({ produtoId: p.produtoId, descricao: p.descricao, status: r.status, reason: r.error });
    }
    const cart = await getCart();
    for (const want of list) {
      const line = cart.items.find(i => i.produtoId === want.produtoId);
      if (line && want.expectedPrice != null && Math.abs(line.unitPrice - want.expectedPrice) >= 0.005)
        report.priceChanges.push({ produtoId: line.produtoId, descricao: line.descricao, expected: want.expectedPrice, now: line.unitPrice, emOferta: line.emOferta });
    }
    const ship = await getShipping(cart);
    report.total = cart.total; report.valorMinimo = cart.valorMinimo; report.belowMinimum = cart.valorMinimo != null && cart.total < cart.valorMinimo;
    report.frete = ship.home ? { tipo: ship.home.descricao, frete: ship.home.frete, desconto: ship.home.desconto, efetivo: ship.home.freteEfetivo, nextSlot: ship.home.slots[0] || null } : null;
    report.cart = cart.items.map(i => ({ produtoId: i.produtoId, qty: i.qty, unitPrice: i.unitPrice }));
    return report;
  }
  return { cfg, call, getCart, getProduct, search, addItem, setQty, removeItem, clearCart, restoreCart, getDeliveryAddress, getShipping, fillCartFromList };
})();
