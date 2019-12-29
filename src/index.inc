<!DOCTYPE html>
<!-- 
Copyright (C) Eelco Vriezekolk, Universiteit Twente, Agentschap Telecom.
See LICENSE.md
 -->
<html>

<head>
#ifdef SERVER
<meta name="group" content="<?= GROUP ?>">
#endif
<meta http-equiv="Content-Type" content="text/html;charset=utf-8" >
<meta charset="UTF-8"> 
<title>Raster - Risk Assessment of Telecoms Services</title>
<!-- First stylesheet must be the one that is a custom setting. -->
<link rel="stylesheet" href="../css/smoothness-1.12.1/jquery-ui.min.css" class="ui-theme">
<link rel="stylesheet" href="../css/raster.css" type="text/css" id="maincssfile">
<link rel="stylesheet" href="../css/raster-print.css" type="text/css">
<link rel="shortcut icon" href="../img/Raster.png">
#ifdef STANDALONE
  <script type="text/javascript">if (typeof module === 'object') {window.module = module; module = undefined;}</script>
#endif
<script type="text/javascript" src="../js/jquery-3.4.1.min.js"></script>
<script type="text/javascript" src="../js/jquery-ui-1.12.1.min.js"></script>
#ifdef SERVER
<script type="text/javascript" src="../js/eventsource.js"></script>
<script type="text/javascript" src="../js/jquery.localisation.js"></script>
#endif
<script type="text/javascript" src="../js/jsplumb-2.12.0.min.js"></script>
<script type="text/javascript" src="../js/jquery.editinplace-2.2.1.js"></script>
<script type="text/javascript" src="../js/encodedecode.js"></script>
<script type="text/javascript" src="../js/headroom.min.js"></script>
#ifdef SERVER
<script type="text/javascript">$.localise('../js/translation', {async: false, language: "<?= LANGUAGE ?>".replace(/(;.+)/,'').replace(/,.+/,'')});</script>
#else
#ifdef LANG_NL
  <script src="../js/translation-nl.js"></script>
#endif
#endif
<link rel="preload" href="../img/qm-hi.png" as="image">
<link rel="preload" href="../img/find-hi.png" as="image">
<script type="text/javascript" src="../js/rasterMain.js"></script>
<script type="text/javascript" src="../js/rasterProject.js"></script>
<script type="text/javascript" src="../js/rasterService.js"></script>  
<script type="text/javascript" src="../js/rasterThreatEvaluation.js"></script>  
<script type="text/javascript" src="../js/rasterComponent.js"></script>  
<script type="text/javascript" src="../js/rasterNode.js"></script>  
<script type="text/javascript" src="../js/rasterNodeCluster.js"></script>  
<script type="text/javascript" src="../js/rasterPreferencesObject.js"></script>  
#ifdef STANDALONE
  <script type="text/javascript">if (window.module) module = window.module;</script>
#endif

<style type="text/css">
.fullscreen {
    position: absolute;
    width: 100%;
    height: 100%;
    background: grey;
    opacity: 0.95;
    z-index: 9998;
    left: 0;
    top: 0;
}
.fullscreen p {
    color: white;
    text-align: center;
    font-size: 18pt;
    font-family: "Lucida Sans Unicode", "Lucida Grande", sans-serif;
}
</style>
</head>

<body>
<div id="splash" class="fullscreen">
 <p style="font-size: 28pt;">Raster</p>
 <p>Risk Assessment of Telecommunication Services</p>
 <p><small><span id="splashstatus">please wait . . .</span></small></p>
</div>
<div id="goodbye" class="fullscreen" style="display: none;">
 <p style="font-size: 28pt;">Raster</p>
 <p>&nbsp;</p>
 <p><small>goodbye</small></p>
</div>

#ifdef SERVER
<div id="toolbar" class="donotprint">
	<div id="networkactivity"></div>
	<div id="libraryactivator" class="ui-widget ui-button toolbaritem activator"><span>Library</span><span>...</span></div>
	<div id="optionsactivator" class="ui-widget ui-button toolbaritem activator"><span>Options</span><span>...</span></div>
	<div class="toolbarspacer"></div>
	<div id="findbutton" class="ui-button toolbaritem"></div>
	<div class="toolbarspacer"></div>
	<div id="templates" class="ui-state-default toolbaritem"> <!-- Is filled in Project.load() --></div>
	<div class="toolbarspacer"></div>
	<div id="helpbutton" class="ui-button toolbaritem"></div>
	#ifdef CLASSROOM
	<div class="toolbarspacer"></div>
	<div id="demo" class="ui-widget toolbaritem"></div>
	<div class="toolbarspacer"></div>
	#endif
</div> <!-- toolbar -->
<div id="currentProject" class="ui-widget projectname"></div>

<div id="librarypanel" class="actpanel">
  <form id="libform">
    <table>
    <tr><td>
        <input id="libactivate" type="button" value="Activate">
        <input id="libprops" type="button" value="Details">
        <input id="libexport" type="button" value="Export">
        <input id="libdel" type="button" value="Delete">
        <input id="libmerge" type="button" value="Merge">
        <input id="libcheck" type="button" value="?">
    </td></tr>
    <tr><td>
        <select id="libselect" size="8"></select>
    </td></tr>
    <tr><td style="padding-bottom:1px">
        <input id="libadd" type="button" value="New">
        <input id="libimport" type="button" value="Import">
        <input id="libexportall" type="button" value="Export library">
        <input id="fileElem" type="file">
        <input id="libzap" type="button" value="Zap library">
    </td>
    </tr>
    </table>
  </form>
</div>

<div id="optionspanel" class="actpanel">
    <div id="emblem_size">
        <span class="leftlabel ui-widget ui-state-default">Vulnerability levels:</span>
        <fieldset>
            <input type="radio" id="em_small" name="emblem_size" checked="checked"><label for="em_small">Small</label>
            <input type="radio" id="em_large" name="emblem_size"><label for="em_large">Large</label>
            <input type="radio" id="em_none" name="emblem_size"><label for="em_none">None</label>
        </fieldset>
    </div>
    <div id="labelonoff">
        <span class="leftlabel ui-widget ui-state-default">Labels:</span>
        <fieldset>
            <input type="radio" id="label_off" name="labelonoff"><label for="label_off">Hide color</label>
            <input type="radio" id="label_on" name="labelonoff" checked="checked"><label for="label_on">Show color</label>
        </fieldset>
    </div>
    <div id="onlineonoff">
        <span class="leftlabel ui-widget ui-state-default">Network connection:</span>
        <fieldset>
            <input type="radio" id="online_off" name="onlineonoff"><label for="online_off">Offline</label>
            <input type="radio" id="online_on" name="onlineonoff" checked="checked"><label for="online_on">Online</label>
        </fieldset>
    </div>
    <div id="creator_name">
        <span class="leftlabel ui-widget ui-state-default">Your name:</span>
        <input type="text" id="creator">
    </div>
</div>
#endif

#ifdef STANDALONE
<div id="templates" class="floatingtoolbar"> <!-- Is filled in Project.load() --></div>

<div id="pdfoptions">
    <div id="pdf_orientation" class="controlgroup">
        <span class="pdflabel ui-widget ui-state-default">Orientation:</span>
        <fieldset>
            <input type="radio" name="pdf_orientation" id="paperorientation_portrait"><label id="label_portrait" for="paperorientation_portrait">XXX</label>
            <input type="radio" name="pdf_orientation" id="paperorientation_landscape"><label id="label_landscape" for="paperorientation_landscape">YYY</label>
        </fieldset>
    </div>
    <div id="pdf_papersize" class="controlgroup">
        <span class="pdflabel ui-widget ui-state-default">Paper size:</span>
        <fieldset>
            <input type="radio" name="pdf_papersize" id="papersize_a4"><label for="papersize_a4">A4</label>
            <input type="radio" name="pdf_papersize" id="papersize_a3"><label for="papersize_a3">A3</label>
        </fieldset>
    </div>
    <div id="pdf_scale" class="controlgroup">
        <span class="pdflabel ui-widget ui-state-default">Scale:</span>
        <fieldset>
            <input type="radio" name="pdf_scale" id="pdfscale_40"><label for="pdfscale_40">40</label>
            <input type="radio" name="pdf_scale" id="pdfscale_50"><label for="pdfscale_50">50</label>
            <input type="radio" name="pdf_scale" id="pdfscale_60"><label for="pdfscale_60">60</label>
            <input type="radio" name="pdf_scale" id="pdfscale_70"><label for="pdfscale_70">70</label>
            <input type="radio" name="pdf_scale" id="pdfscale_80"><label for="pdfscale_80">80</label>
            <input type="radio" name="pdf_scale" id="pdfscale_90"><label for="pdfscale_90">90</label>
            <input type="radio" name="pdf_scale" id="pdfscale_100"><label for="pdfscale_100">100</label>
        </fieldset>
    </div>
</div>
#endif

<div id="helppanel">
    <div id="helptabs">
        <ul>
            <li><a href="../help/Frequency.html">Frequency</a></li>
            <li><a href="../help/Impact.html">Impact</a></li>
            <li><a href="../help/Process.html">How to use</a></li>
            <li><a href="../help/About.html">About</a></li>
        </ul>
    </div>
</div>

<div id="nodemenu" class="popupmenu">
    <div id="mi_th" class="popupmenuitem">Vulnerabilities</div>
    <div id="mi_ct" class="popupmenuitem"><span>Change type</span><span style="float:right; margin-right:-5px;" class="ui-icon ui-icon-triangle-1-e"></span></div>
     <div id="mi_ctsm" class="popupsubmenu">
      <div id="mi_cttWLS" class="popupmenuitem popupsubmenuitem">Wireless link</div>
      <div id="mi_cttWRD" class="popupmenuitem popupsubmenuitem">Wired link</div>
      <div id="mi_cttEQT" class="popupmenuitem popupsubmenuitem">Equipment</div>
      <div id="mi_cttACT" class="popupmenuitem popupsubmenuitem">Actor</div>
      <div id="mi_cttUNK" class="popupmenuitem popupsubmenuitem">Unknown link</div>
     </div>
    <div id="mi_cl" class="popupmenuitem"><span>Class</span><span style="float:right; margin-right:-5px;" class="ui-icon ui-icon-triangle-1-e"></span></div>
     <div id="mi_clsm" class="popupsubmenu">
      <div id="mi_rc" class="popupmenuitem popupsubmenuitem">Rename class</div>
      <div id="mi_sx" class="popupmenuitem popupsubmenuitem">Rename suffix</div>
      <div id="mi_sm" class="popupmenuitem popupsubmenuitem">Similar/Identical</div>
     </div>
    <div id="mi_du" class="popupmenuitem">Duplicate</div>
    <div id="mi_cc" class="popupmenuitem"><div id="mlabel" class="labeltext">Label</div><span style="float:right; margin-right:-5px;" class="ui-icon ui-icon-triangle-1-e"></span></div>
     <div id="mi_ccsm" class="popupsubmenu">
      <div id="mi_ccnone" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="noneblock Bnone"><img src="../img/nolabel.png"></div><span class="plainlabel">No label</span></div>
      <div id="mi_ccred" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bred"></div><div class="labeltext">Red</div></div>
      <div id="mi_ccorange" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Borange"></div><div class="labeltext">Orange</div></div>
      <div id="mi_ccyellow" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Byellow"></div><span class="labeltext">Yellow</span></div>
      <div id="mi_ccgreen" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bgreen"></div><span class="labeltext">Green</span></div>
      <div id="mi_ccblue" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bblue"></div><span class="labeltext">Blue</span></div>
      <div id="mi_ccpink" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bpink"></div><span class="labeltext">Pink</span></div>
      <div id="mi_ccpurple" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bpurple"></div><span class="labeltext">Purple</span></div>
      <div id="mi_ccgrey" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bgrey"></div><span class="labeltext">Grey</span></div>
      <div id="mi_ccedit" class="popupmenuitem popupsubmenuitem labelmenuitem"><span class="plainlabel">Edit labels ...</span></div>
     </div>
    <div id="mi_de" class="popupmenuitem">Delete</div>
</div>
<div id="selectmenu" class="popupmenu">
    <div id="mi_sd" class="popupmenuitem">Delete selection</div>
    <div id="mi_sc" class="popupmenuitem"><span>Label</span><span style="float:right; margin-right:-5px;" class="ui-icon ui-icon-triangle-1-e"></span></div>
     <div id="mi_scsm" class="popupsubmenu">
      <div id="mi_scnone" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="noneblock Bnone"><img src="../img/nolabel.png"></div><span class="plainlabel">No label</span></div>
      <div id="mi_scred" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bred"></div><div class="labeltext">Red</div></div>
      <div id="mi_scorange" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Borange"></div><div class="labeltext">Orange</div></div>
      <div id="mi_scyellow" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Byellow"></div><span class="labeltext">Yellow</span></div>
      <div id="mi_scgreen" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bgreen"></div><span class="labeltext">Green</span></div>
      <div id="mi_scblue" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bblue"></div><span class="labeltext">Blue</span></div>
      <div id="mi_scpink" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bpink"></div><span class="labeltext">Pink</span></div>
      <div id="mi_scpurple" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bpurple"></div><span class="labeltext">Purple</span></div>
      <div id="mi_scgrey" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bgrey"></div><span class="labeltext">Grey</span></div>
      <div id="mi_scedit" class="popupmenuitem popupsubmenuitem labelmenuitem"><span class="plainlabel">Edit labels ...</span></div>
     </div>
</div>
<div id="ccfmenu" class="popupmenu">
    <div id="mi_ccfc" class="popupmenuitem">Create new cluster</div>
    <div id="mi_ccfm" class="popupmenuitem"><span>Move to</span><span style="float:right; margin-right:-5px;" class="ui-icon ui-icon-triangle-1-e"></span></div>
     <div id="mi_ccfmsm" class="popupsubmenu">
     </div>
</div>
<div id="nodereport" class="nodereport"></div>
<div id="componentthreats" class="componentthreats"></div>

<div id="checklist_tWLS" class="checklist">
    <div class="threat"><div class="th_name th_col thr_header">Name</div><div class="th_descr th_col thr_header">Description</div></div>
    <div id="tWLSthreats" class="threats">
    </div>
    <input id="tWLSaddthreat" class="addthreatbutton" type="button" value="+ Add vulnerability">
    <input id="tWLScopythreat" class="copybutton" type="button" value="Copy">
    <input id="tWLSpastethreat" class="pastebutton" type="button" value="Paste">
</div>
<div id="checklist_tWRD" class="checklist">
    <div class="threat"><div class="th_name th_col thr_header">Name</div><div class="th_descr th_col thr_header">Description</div></div>
    <div id="tWRDthreats" class="threats">
    </div>
    <input id="tWRDaddthreat" class="addthreatbutton" type="button" value="+ Add vulnerability">
    <input id="tWRDcopythreat" class="copybutton" type="button" value="Copy">
    <input id="tWRDpastethreat" class="pastebutton" type="button" value="Paste">
</div>
<div id="checklist_tEQT" class="checklist">
    <div class="threat"><div class="th_name th_col thr_header">Name</div><div class="th_descr th_col thr_header">Description</div></div>
    <div id="tEQTthreats" class="threats">
    </div>
    <input id="tEQTaddthreat" class="addthreatbutton" type="button" value="+ Add vulnerability">
    <input id="tEQTcopythreat" class="copybutton" type="button" value="Copy">
    <input id="tEQTpastethreat" class="pastebutton" type="button" value="Paste">
</div>

<div id="tabs">
    <ul>
        <li><a href="#tab_diagrams">Diagrams</a></li>
        <li><a href="#tab_singlefs">Single failures</a></li>
        <li class="longtab"><a href="#tab_ccfs" class="longlink">Common cause failures</a></li>
        <li><a href="#tab_analysis">Analysis</a></li>
    </ul>
    

<div id="tab_diagrams" class="workbody workouter">
  <div id="diagrams_body" class="tabs-bottom">
  	<div id="mask-collection" class="donotprint"><!-- mask images to be inserted here --></div>
    <input id="servaddbuttondia" class="servplusbutton" type="button" value=" + ">
    <ul id="bottomtabsdia">
    </ul>
  </div>    
</div>


<div id="tab_singlefs" class="workbody workouter">
  <div id="singlefs_body" class="tabs-bottom">
    <input id="servaddbuttonsf" class="servplusbutton" type="button" value=" + ">
    <ul id="bottomtabssf">
    </ul>
  </div>    
</div>


<div id="tab_ccfs" class="workbody workouter">
  <div id="ccfs_body" class="workbody workinner ui-widget-content"></div>
  <div id="ccfs_details" class="workbody workinner ui-widget-content"></div>
</div>


<div id="tab_analysis" class="workbody workouter">
  <div id="analysis_body" class="tabs-bottom tabs-flushleft">
  <ul id="bottomtabsana">
     <li class="longtab"><a class="longlink" href="#at1">Failures and Vulnerabilities</a></li>
     <li class="longtab"><a class="longlink" href="#at2">Single failures by level</a></li>
     <li class="longtab"><a class="longlink" href="#at3">Node counts</a></li>
     <li class="longtab"><a class="longlink" href="#at4">Checklist reports</a></li>
     <li class="longtab"><a class="longlink" href="#at5">Longlist</a></li>
  </ul>
  <div id="at1" class="workspace plainworkspace"></div>
  <div id="at2" class="workspace plainworkspace"></div>
  <div id="at3" class="workspace plainworkspace"></div>
  <div id="at4" class="workspace plainworkspace"></div>
  <div id="at5" class="workspace plainworkspace"></div>
  </div>
</div>


</div> <!-- id="tabs" -->

<div id="modaldialog"></div>

<div id="exp_div" style="display: none">
<form id="exp_form" action="share.php" method="post" enctype="multipart/form-data">
<input id="exp_action" type="hidden" name="op" value="reflect">
<input id="exp_name" type="text" name="name">
<textarea id="exp_contents" name="contents"></textarea>
</form>
</div>

</body>
</html>
