/* All math-model dialogs keep their close affordance inside the modal card.
   It is the first sticky child of the card's own scroller, so it remains in the
   top-right corner while the user swipes long model/Judge results. */
(function(){
  const MODAL_CLOSES={
    'sg-ov':()=>window.closeSG?.(),
    'if-ov':()=>window.IF_close?.(),
    'qa-ov':()=>window.QA_close?.(),
    'pdx-ov':()=>window.PDX_close?.(),
    'adv-ov':()=>window.ADV_close?.(),
    'cons-ov':()=>window.CONS_close?.(),
    'pick-ov':()=>window.PICK_close?.(),
    'matrix-ov':()=>window.MATRIX_close?.(),
    'mres-ov':()=>window.LotoModals?.closeModal('mres-ov')||document.getElementById('mres-ov')?.classList.remove('show'),
    'period-ov':()=>window.PERIOD_close?.(),
    'genn-ov':()=>window.GENN_close?.(),
    'wc-ov':()=>window.WC_close?.(),
    'sup-ov':()=>window.SUP_close?.(),
    'supc-ov':()=>window.SUPC_close?.(),
    'ticket-ov':()=>window.TK_close?.(),
    'horo-ov':()=>window.HORO_close?.(),
    'qab-ov':()=>window.QAB_close?.(),
    'jc-ov':()=>window.JC_close?.()
  };
  function install(){
    Object.entries(MODAL_CLOSES).forEach(([id,close])=>{
      const ov=document.getElementById(id);if(!ov)return;
      const sheet=ov.querySelector(':scope > .if-sheet,:scope > .sg-sheet,:scope > .lang-box,:scope > .horo-sheet')||ov.firstElementChild;
      if(!sheet)return;
      let btn=Array.from(ov.querySelectorAll('button')).find(b=>b.textContent.trim()==='✕');
      if(!btn){
        btn=document.createElement('button');btn.type='button';btn.textContent='✕';
      }
      if(btn.parentElement!==sheet||btn!==sheet.firstElementChild)sheet.insertBefore(btn,sheet.firstChild);
      btn.classList.add('modal-static-close');
      sheet.classList.add('modal-has-static-close');
      const clearance=sheet.querySelector(':scope > .if-hdr,:scope > .lang-title,:scope > .sg-header,:scope > .horo-ribbon')||btn.nextElementSibling;
      if(clearance)clearance.classList.add('modal-static-close-clearance');
      btn.setAttribute('aria-label',appText('Закрыть'));
      if(id!=='mres-ov')btn.onclick=e=>{e.stopPropagation();close();};
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  document.addEventListener('loto:language-changed',()=>document.querySelectorAll('.modal-static-close').forEach(b=>b.setAttribute('aria-label',appText('Закрыть'))));
})();
