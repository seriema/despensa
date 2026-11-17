# Krill (VipCommerce) API notes

Mapped 2026-11-17 against the live site with the household's account. No order was placed during testing.
Treat "guess" items as unverified.

## Basics

- Base URL: `https://services.vipcommerce.com.br/api-admin/v1/org/216/`
- Ids: organization **216**, branch (`filial`) **1**, distribution centre (CD) **20** (Krill Boiçucanga, Estrada do Cascalho 415). CD 20 serves both home delivery and pickup.
- Below, `CD/` = `filial/1/centro_distribuicao/20/loja/`.
- Headers on every call: `Content-Type` and `Accept: application/json`, `DomainKey: lojasredekrill.com.br`, `OrganizationId: 216`, `sessao-id: <cookie sessao-id>`, `Authorization: Bearer <token>`.
- Product images: `https://produto-assets-vipcommerce-com-br.br-se1.magaluobjects.com/250x250/<imagem>`.
- CORS allows other origins, so a WebView or other app can call the API.

## Tokens (important)

| Token | What it is | Use |
|---|---|---|
| `cliente-token` (cookie) | Customer JWT (`vipcommerceClienteId`, no `exp`) | **Required for the cart, orders and addresses.** With `vip-token` the cart reads as `data:null`. |
| `vip-token` (cookie) | Store JWT from `POST auth/loja/login {domain, username:"loja", key}`. The key is public, in the site's JS. | Catalogue and search only |

- **Login:** `POST filial/1/loja/logar {usuario, password, captchaToken}`. reCAPTCHA is required, and the account may be sent to SMS/MFA phone validation.
- **Token refresh:** the response header `X-Auth-Upgrade` replaces the client token. Browser JS can't read it; native HTTP can.
- **Errors:** 401 means logged out. 403 "MFA Required" means phone verification.
- **Plan:** log in once in an embedded WebView of the real site, then read the `cliente-token` and `sessao-id` cookies (Android CookieManager). Store them encrypted, call the API with native HTTP, and save any `X-Auth-Upgrade`. On 401, show the WebView login again. Never store the password.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `filial/1/loja/compras/N?page=n` | Order history, 20 per page. `produtos[]`: `produto_id, quantidade, preco` (list), `preco_venda` (paid), `imagem`, `departamento` |
| GET | `CD/produtos/{id}/detalhes` | Also `classificacao_mercadologica_id` (section) and `marca_id` (brand). A discontinued product returns no `produto`. |
| GET | `CD/buscas/produtos/termo/{q}?page=1` | Search |
| GET | `CD/classificacoes_mercadologicas/departamentos/arvore` | Category tree: departments → sections (`classificacao_mercadologica_id`, `descricao`, `children`) |
| GET | `CD/classificacoes_mercadologicas/departamentos/{deptId}/produtos?page=1&secao={sectionId}` | All products in a section, with current price/offer: basis for "any brand – cheapest" |
| GET | `CD/carrinhos` | Cart: `carrinho_id, preco` (total), `quantidade` (units), `itens[]{produto_id, item_id, quantidade, preco, oferta}`, `valor_minimo` (99), `quantidade_limite` (50 lines), `peso_total` |
| POST | `CD/carrinhos/atualizar_item/omnichannel` | `{mercadoria_id, quantidade, observacao:"", tipo:1, item_id}`. **Sets an absolute quantity**; creates the line if needed (`item_id` = produto_id for a new line). Returns 400 for unavailable items, over max, or qty 0. |
| POST | `CD/carrinhos/atualizar_varios/omnichannel` | Bulk `[{mercadoria_id, quantidade, tipo:1}]`. Sets quantities; **silently skips** unavailable items. |
| DELETE | `CD/carrinhos/remover_item/{item_id}` | Uses the cart `item_id`, not the produto_id |
| GET | `filial/1/loja/clientes/enderecos/getEnderecosEntrega` | Customer's delivery addresses (`id`, `principal`, `cep`, `endereco_formatado`); pick `principal` |
| GET | `CD/compras/checkout/calcular_frete/endereco/{endId}/total_itens/{units}?peso_itens={kg}&tipo_cliente=AM` | Delivery types for the current server cart: `{id, descricao, retirada_loja, frete, desconto, horarios_formatados[{key,label}]}` |

## Facts

- **Home delivery** (type 9, "Entrega Agendada"): frete R$30, which is fully discounted once the cart is above ~R$600 (confirmed between R$589 and R$606). 8 time slots starting the next day.
- **Pickup:** type 36, free.
- **Minimum order:** R$99. **Max 50 lines** per cart.
- **Unavailable items** have `disponivel:false` and `quantidade_maxima:"0"`. `quantidade_maxima` is probably the current stock cap (guess).
- **The cart is shared** with the website and the user's own manual edits. Snapshot it before filling and merge, don't overwrite.
- **Delivery vs pickup** is a browser-only setting (`localStorage.formaEntregaSelecionada`, 1 = delivery); type, address and slot are only fixed at checkout. The app stops before checkout and the user finishes on the Krill site.

## Reference implementation

`krillCart` JS module (getCart, getProduct, search, setQty, addItem, removeItem, clearCart, restoreCart, getShipping, fillCartFromList → report {added, unavailable, partial, failed, priceChanges, total, frete, belowMinimum}). It was tested twice end to end and the cart was restored both times. To be ported to `app/src/stores/krill/` as TypeScript, taking its tokens from the app instead of cookies.
