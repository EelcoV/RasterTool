<!DOCTYPE html> <!-- HTML 5 is still in draft -->
<!-- $Id: index.inc,v 1.1.2.2 2013/07/18 19:52:23 vriezekolke Exp $ -->
<html>

<head>

<meta http-equiv="Content-Type" content="text/html;charset=utf-8" >
<meta charset="UTF-8"> 
<title>Raster - Risk Assessment of Telecoms Services</title>
<link rel="stylesheet" href="../css/smoothness/jquery-ui-1.8.21.custom.css" class="ui-theme">
<link rel="stylesheet" href="../css/raster.css" type="text/css" id="maincssfile">
<link rel="stylesheet" href="../css/raster-print.css" type="text/css">
<link rel="shortcut icon" href="../img/Raster.png">
<!--script type="text/javascript" src="../js/eventsource.js"></script-->
<script type="text/javascript" src="../js/jquery-1.7.2.js"></script>
<script type="text/javascript" src="../js/jquery-ui-1.8.21.custom.min.js"></script>
<script type="text/javascript" src="../js/ui.tabs.closable.js"></script>
<script type="text/javascript" src="../js/jquery.jsPlumb-1.5.5.js"></script>
<script type="text/javascript" src="../js/jquery.editinplace-2.2.1.js"></script>  
<script type="text/javascript" src="../js/jquery.json-2.2.min.js"></script>  
<script type="text/javascript" src="../js/encodedecode.js"></script>
<script type="text/javascript" src="../js/rasterMain.js"></script>  
<script type="text/javascript" src="../js/rasterProject.js"></script>  
<script type="text/javascript" src="../js/rasterService.js"></script>  
<script type="text/javascript" src="../js/rasterThreatEvaluation.js"></script>  
<script type="text/javascript" src="../js/rasterComponent.js"></script>  
<script type="text/javascript" src="../js/rasterNode.js"></script>  
<script type="text/javascript" src="../js/rasterNodeCluster.js"></script>  
<script type="text/javascript" src="../js/rasterPreferencesObject.js"></script>  

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

<div id="networkactivity" class="donotprint"></div>

<div id="templates">
	<div class="template t1">
		<div id="tWLS" class="templatebg"><img class="templateicon" src="../img/tWLSicon.png"></div>
		<div class="templatelabel ui-widget">Wireless</div>
		<img id="tC_tWLS" class="tC" src="../img/dropdown.png">
	</div>
	<div class="template t2">
		<div id="tWRD" class="templatebg"><img class="templateicon" src="../img/tWRDicon.png"></div>
		<div class="templatelabel ui-widget">Wired</div>
		<img id="tC_tWRD" class="tC" src="../img/dropdown.png">
	</div>
	<div class="template t3">
		<div id="tEQT" class="templatebg"><img class="templateicon" src="../img/tEQTicon.png"></div>
		<div class="templatelabel ui-widget">Equipment</div>
		<img id="tC_tEQT" class="tC" src="../img/dropdown.png">
	</div>
	<div class="template t4">
		<div id="tACT" class="templatebg"><img class="templateicon" src="../img/tACTicon.png"></div>
		<div class="templatelabel ui-widget">Actor</div>
	</div>
	<div class="template t5">
		<div id="tUNK" class="templatebg"><img class="templateicon" src="../img/tUNKicon.png"></div>
		<div class="templatelabel ui-widget">Unknown</div>
	</div>
</div> <!-- id="templates" -->

<div id="libraryactivator" class="activator ui-widget">Library<span id="libraryupdown" style="float:right" class="ui-icon ui-icon-triangle-1-s"></span></div>
<div id="optionsactivator" class="activator ui-widget">Options<span id="optionsupdown" style="float:right" class="ui-icon ui-icon-triangle-1-s"></span></div>

<div id="librarypanel" class="actpanel ui-widget">
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

<div id="optionspanel" class="actpanel ui-widget">
	<div id="switcher">
		<span class="leftlabel">Visual style:</span>
		<input type="radio" id="smoothness" name="switcher" checked="checked"><label for="smoothness">Smoothness</label>
		<input type="radio" id="pepper-grinder" name="switcher"><label for="pepper-grinder">Pepper Grinder</label>
		<input type="radio" id="redmond" name="switcher"><label for="redmond">Redmond</label>
	</div>
	<div id="gridonoff">
		<span class="leftlabel">Move nodes:</span>
		<input type="radio" id="grid_off" name="gridonoff" checked="checked"><label for="grid_off">Move freely</label>
		<input type="radio" id="grid_on" name="gridonoff"><label for="grid_on">Snap to grid</label>
	</div>
	<div id="emblem_size">
		<span class="leftlabel">Vulnerability levels:</span>
		<input type="radio" id="em_small" name="emblem_size" checked="checked"><label for="em_small">Small</label>
		<input type="radio" id="em_large" name="emblem_size"><label for="em_large">Large</label>
		<input type="radio" id="em_none" name="emblem_size"><label for="em_none">None</label>
	</div>
	<div id="labelonoff">
		<span class="leftlabel">Labels:</span>
		<input type="radio" id="label_off" name="labelonoff"><label for="label_off">Hide color</label>
		<input type="radio" id="label_on" name="labelonoff" checked="checked"><label for="label_on">Show color</label>
	</div>
	<div id="onlineonoff">
		<span class="leftlabel">Network connection:</span>
		<input type="radio" id="online_off" name="onlineonoff"><label for="online_off">Offline</label>
		<input type="radio" id="online_on" name="onlineonoff" checked="checked"><label for="online_on">Online</label>
	</div>
	<div id="creator_name">
		<span class="leftlabel">Your name:</span>
		<input type="text" id="creator" size="35">
	</div>
	<p>Raster prototype 4. For help <a id="manual" href="../manual-0.8.pdf" target="rastermanual">see the manual</a>.</p>
</div>

<div id="nodemenu" class="popupmenu">
	<div id="mi_th" class="popupmenuitem">Vulnerabilities</div>
	<div id="mi_ct" class="popupmenuitem">Change type<span style="float:right; margin-right:-5px;" class="ui-icon ui-icon-triangle-1-e"></span></div>
	 <div id="mi_ctsm" class="popupsubmenu">
	  <div id="mi_cttWLS" class="popupmenuitem popupsubmenuitem">Wireless link</div>
	  <div id="mi_cttWRD" class="popupmenuitem popupsubmenuitem">Wired link</div>
	  <div id="mi_cttEQT" class="popupmenuitem popupsubmenuitem">Equipment</div>
	  <div id="mi_cttACT" class="popupmenuitem popupsubmenuitem">Actor</div>
	  <div id="mi_cttUNK" class="popupmenuitem popupsubmenuitem">Unknown link</div>
	 </div>
	<div id="mi_sm" class="popupmenuitem">Similar/Identical</div>
	<div id="mi_du" class="popupmenuitem">Duplicate</div>
	<div id="mi_cc" class="popupmenuitem"><div id="mlabel" class="labeltext">Label</div><span style="float:right; margin-right:-5px;" class="ui-icon ui-icon-triangle-1-e"></span></div>
	 <div id="mi_ccsm" class="popupsubmenu">
	  <div id="mi_ccnone" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="Bnone"><img src="../img/nolabel.png"></div>No label</div>
	  <div id="mi_ccred" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bred"></div><div class="labeltext">Red</div></div>
	  <div id="mi_ccorange" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Borange"></div><div class="labeltext">Orange</div></div>
	  <div id="mi_ccyellow" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Byellow"></div><span class="labeltext">Yellow</span></div>
	  <div id="mi_ccgreen" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bgreen"></div><span class="labeltext">Green</span></div>
	  <div id="mi_ccblue" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bblue"></div><span class="labeltext">Blue</span></div>
	  <div id="mi_ccpurple" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bpurple"></div><span class="labeltext">Purple</span></div>
	  <div id="mi_ccgrey" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bgrey"></div><span class="labeltext">Grey</span></div>
	  <div id="mi_ccedit" class="popupmenuitem popupsubmenuitem labelmenuitem">Edit labels ...</div>
	 </div>
	<div id="mi_de" class="popupmenuitem">Delete</div>
</div>
<div id="selectmenu" class="popupmenu">
	<div id="mi_sd" class="popupmenuitem">Delete selection</div>
	<div id="mi_sc" class="popupmenuitem">Label<span style="float:right; margin-right:-5px;" class="ui-icon ui-icon-triangle-1-e"></span></div>
	 <div id="mi_scsm" class="popupsubmenu">
	  <div id="mi_scnone" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="Bnone"><img src="../img/nolabel.png"></div>No label</div>
	  <div id="mi_scred" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bred"></div><div class="labeltext">Red</div></div>
	  <div id="mi_scorange" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Borange"></div><div class="labeltext">Orange</div></div>
	  <div id="mi_scyellow" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Byellow"></div><span class="labeltext">Yellow</span></div>
	  <div id="mi_scgreen" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bgreen"></div><span class="labeltext">Green</span></div>
	  <div id="mi_scblue" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bblue"></div><span class="labeltext">Blue</span></div>
	  <div id="mi_scpurple" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bpurple"></div><span class="labeltext">Purple</span></div>
	  <div id="mi_scgrey" class="popupmenuitem popupsubmenuitem labelmenuitem"><div class="smallblock Bgrey"></div><span class="labeltext">Grey</span></div>
	  <div id="mi_scedit" class="popupmenuitem popupsubmenuitem labelmenuitem">Edit labels ...</div>
	 </div>
</div>
<div id="nodereport" class="nodereport"></div>
<div id="componentthreats" class="componentthreats"></div>

<div id="checklist_tWLS" class="checklist">
	<div class="threat"><div class="th_name thr_header">Name</div><div class="th_descr thr_header">Description</div></div>
	<div id="tWLSthreats" class="threats">
	</div>
	<input id="WLSaddthreat" class="addthreatbutton" type="button" value="+ Add vulnerability">
	<input id="WLScopythreat" class="copybutton" type="button" value="Copy">
	<input id="WLSpastethreat" class="pastebutton" type="button" value="Paste">
</div>
<div id="checklist_tWRD" class="checklist">
	<div class="threat"><div class="th_name thr_header">Name</div><div class="th_descr thr_header">Description</div></div>
	<div id="tWRDthreats" class="threats">
	</div>
	<input id="WRDaddthreat" class="addthreatbutton" type="button" value="+ Add vulnerability">
	<input id="WRDcopythreat" class="copybutton" type="button" value="Copy">
	<input id="WRDpastethreat" class="pastebutton" type="button" value="Paste">
</div>
<div id="checklist_tEQT" class="checklist">
	<div class="threat"><div class="th_name thr_header">Name</div><div class="th_descr thr_header">Description</div></div>
	<div id="tEQTthreats" class="threats">
	</div>
	<input id="EQTaddthreat" class="addthreatbutton" type="button" value="+ Add vulnerability">
	<input id="EQTcopythreat" class="copybutton" type="button" value="Copy">
	<input id="EQTpastethreat" class="pastebutton" type="button" value="Paste">
</div>

<div id="currentProject" class="donotprint projectname ui-widget"></div>

<div id="tabs">
	<ul>
		<li><a href="#tab_diagrams">Diagrams</a></li>
		<li><a href="#tab_singlefs">Single failures</a></li>
		<li class="longtab"><a href="#tab_ccfs" class="longlink">Common cause failures</a></li>
		<li><a href="#tab_analysis">Analysis</a></li>
	</ul>
	

<div id="tab_diagrams" class="workbody workouter">
  <div id="diagrams_body" class="tabs-bottom">
  <div id="selectrect"></div>
	<input id="servaddbutton" class="servplusbutton" type="button" value=" + ">
	<ul>
	</ul>
  </div>	
</div>


<div id="tab_singlefs" class="workbody workouter">
  <div id="singlefs_body" class="tabs-bottom">
	<input id="servaddbuttonsf" class="servplusbutton" type="button" value=" + ">
	<ul>
	</ul>
  </div>	
</div>


<div id="tab_ccfs" class="workbody workouter">
  <div id="ccfs_body" class="workbody workinner ui-widget-content">
  </div>
</div>


<div id="tab_analysis" class="workbody workouter">
  <div id="analysis_body" class="tabs-bottom tabs-flushleft">
  <ul>
 	<li class="longtab"><a class="longlink" href="#at1">Failures and Vulnerabilities</a></li>
 	<li class="longtab"><a class="longlink" href="#at2">Single failures by level</a></li>
 	<li class="longtab"><a class="longlink" href="#at3">Node counts</a></li>
 	<li class="longtab"><a class="longlink" href="#at4">Checklist reports</a></li>
  </ul>
  <div id="at1" class="workspace plainworkspace"></div>
  <div id="at2" class="workspace plainworkspace"></div>
  <div id="at3" class="workspace plainworkspace"></div>
  <div id="at4" class="workspace plainworkspace"></div>
  </div>
</div>


</div> <!-- id="tabs" -->

<div id="anareport"></div>
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
