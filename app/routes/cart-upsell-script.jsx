export const loader = () => {
  const js = `
(function() {
  var appUrl = "https://brandsbro-upsell.onrender.com";
  var shopDomain = window.Shopify && window.Shopify.shop;
  if (!shopDomain) return;

  function loadUpsellProducts(callback) {
    fetch(appUrl + "/api/cart-upsell?shop=" + shopDomain)
      .then(function(r) { return r.json(); })
      .then(function(data) { callback(data.products || []); })
      .catch(function() { callback([]); });
  }

  function buildWidget(products) {
    var existing = document.getElementById("bb-cart-upsell-widget");
    if (existing) existing.remove();
    var widget = document.createElement("div");
    widget.id = "bb-cart-upsell-widget";
    widget.style.cssText = "padding:16px;border-top:1px solid #e5e5e5;";
    widget.innerHTML = '<p style="font-size:13px;font-weight:700;margin:0 0 12px;color:#333;">You might also like</p>' +
      '<div id="bb-upsell-track" style="display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px;">' +
      products.map(function(p) {
        var vid = p.variantId.split("/").pop();
        return '<div style="flex-shrink:0;width:130px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">' +
          (p.image ? '<img src="' + p.image + '" style="width:100%;height:90px;object-fit:cover;"/>' : '') +
          '<div style="padding:8px;">' +
          '<p style="font-size:11px;font-weight:600;margin:0 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.title + '</p>' +
          '<p style="font-size:11px;color:#666;margin:0 0 6px;">$' + p.price + '</p>' +
          '<button id="bb-btn-' + vid + '" onclick="bbUpsellAdd(\'' + vid + '\')" style="width:100%;background:#000;color:#fff;border:none;border-radius:4px;padding:5px;font-size:11px;font-weight:600;cursor:pointer;">+ Add</button>' +
          '</div></div>';
      }).join('') + '</div>';
    return widget;
  }

  function injectWidget(widget) {
    var cartDrawer = document.querySelector("cart-drawer");
    if (!cartDrawer) return;
    var footer = cartDrawer.querySelector(".drawer__footer");
    if (footer && !footer.querySelector("#bb-cart-upsell-widget")) {
      footer.insertBefore(widget, footer.firstChild);
    }
  }

  window.bbUpsellAdd = function(variantId) {
    var btn = document.getElementById("bb-btn-" + variantId);
    if (btn) { btn.disabled = true; btn.textContent = "Adding..."; }
    fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: parseInt(variantId), quantity: 1 }] })
    })
    .then(function(r) { return r.json(); })
    .then(function() {
      if (btn) { btn.textContent = "✓ Added"; btn.style.background = "#008060"; }
      setTimeout(function() {
        fetch("/?sections=cart-drawer,cart-icon-bubble")
          .then(function(r) { return r.json(); })
          .then(function(sections) {
            var cartDrawer = document.querySelector("cart-drawer");
            if (cartDrawer && typeof cartDrawer.renderContents === "function") {
              cartDrawer.classList.remove("is-empty");
              cartDrawer.renderContents({ sections: sections });
            }
            var doc = new DOMParser().parseFromString(sections["cart-icon-bubble"] || "", "text/html");
            var newBubble = doc.querySelector(".cart-count-bubble");
            var oldBubble = document.querySelector(".cart-count-bubble");
            if (oldBubble && newBubble) oldBubble.outerHTML = newBubble.outerHTML;
            setTimeout(function() {
              loadUpsellProducts(function(products) {
                if (products.length) injectWidget(buildWidget(products));
              });
            }, 100);
          });
      }, 800);
      setTimeout(function() {
        if (btn) { btn.textContent = "+ Add"; btn.style.background = "#000"; btn.disabled = false; }
      }, 2000);
    });
  };

  loadUpsellProducts(function(products) {
    if (!products.length) return;
    var widget = buildWidget(products);
    document.body.appendChild(widget);
    var cartDrawer = document.querySelector("cart-drawer");
    if (cartDrawer) {
      new MutationObserver(function() {
        if (cartDrawer.classList.contains("active")) {
          injectWidget(widget);
        }
      }).observe(cartDrawer, { attributes: true, attributeFilter: ["class"] });
    }
  });
})();
`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
