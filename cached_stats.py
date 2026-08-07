import os
import logging
import httpx

logger = logging.getLogger(__name__)

FIELDPLAN_URL = "https://matthewabrey.github.io/Abrey-Cropping/FieldPlan.html"
FIELDPLAN_PATH = os.path.join(os.path.dirname(__file__), "data", "fieldplan.html")

# Injected into the downloaded copy: permanently hide the "changes pending review"
# banner and support an ?estate=<name> URL param to auto-select an estate on the map.
INJECTION = """
<style>#change-banner{display:none !important}</style>
<script>
(function(){
  var est = new URLSearchParams(window.location.search).get('estate');
  if(!est) return;
  var tries = 0;
  function apply(){
    tries++;
    var sel = document.getElementById('mp-estate');
    if(sel && typeof window._mapSwitchEstate === 'function'){
      sel.value = est;
      window._mapSwitchEstate(est);
    } else if(tries < 20){
      setTimeout(apply, 300);
    }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(apply, 300); });
  } else {
    setTimeout(apply, 300);
  }
})();
</script>
"""


async def download_fieldplan():
    """Download the external FieldPlan page, inject our tweaks and save locally."""
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as http_client:
        resp = await http_client.get(FIELDPLAN_URL)
        resp.raise_for_status()
        html = resp.text
    # Inject before the LAST </body> — the page's own JS contains "</body>" inside strings
    i = html.rfind("</body>")
    if i != -1:
        html = html[:i] + INJECTION + html[i:]
    else:
        html += INJECTION
    os.makedirs(os.path.dirname(FIELDPLAN_PATH), exist_ok=True)
    tmp_path = FIELDPLAN_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(html)
    os.replace(tmp_path, FIELDPLAN_PATH)
    logger.info(f"FieldPlan downloaded and saved ({len(html)} chars)")
    return len(html)
