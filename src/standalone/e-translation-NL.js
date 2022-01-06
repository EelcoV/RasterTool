var _t = new Array;

function translate(s) {
    var str = _t[s];
    if (!str) {
    	console.log("_t['" + s + "'] = '';")
        str=s;
	}
    // Replace %1, %2, ... %9 by the first, second, ... ninth argument.
    //for (var i=1; i<10; i++) {
    //    str = str.replace("%"+i, arguments[i])
    //}
    var i = 1;
    while (i<arguments.length) {
        str = str.replace("%%", arguments[i]);
        i++;
    }
    return str;
}


exports.translate = translate;

_t["About this program"] = "Over dit programma";
_t["About..."] = "Info...";
_t["All files"] = "Alle bestanden";
_t["An error occurred while printing"] = "Er was een probleem bij het afdrukken";
_t["An update of this tool is available."] = "Er is een bijgewerkte versie van deze applicatie beschikbaar.";
_t["Cancel"] = "Annuleer";
_t["Cancel to save changes."] = "Annuleer om wijzigingen op te slaan.";
_t["Cannot read the file"] = "Kan het bestand niet inlezen";
_t["Close"] = "Sluiten";
_t["Copy"] = "Kopiëren";
_t["Cut"] = "Knippen";
_t["Developer tools"] = "Ontwikkelhulpprogramma's";
_t["Discard all changes?"] = "Wijzigingen negeren?";
_t["Discard changes"] = "Wijzigingen negeren";
_t["Edit"] = "Bewerken";
_t["File"] = "Bestand";
_t["File was not saved"] = "Bestand is niet opgeslagen";
_t["Find nodes..."] = "Zoek componenten...";
_t["Full screen"] = "Volledig scherm";
_t["Help"] = "Help";
_t["Hide labels"] = "Verberg labels";
_t["Hide mini-map"] = "Verberg minimap";
_t["Labels"] = "Labels";
_t["Large vulnerability levels"] = "Grote kwetsbaarheidsindicator";
_t["Mini-map"] = "Minimap";
_t["Minimize"] = "Minimaliseren";
_t["New"] = "Nieuw";
_t["No name - Raster"] = "Naamloos - Raster";
_t["No vulnerability levels"] = "Geen kwetsbaarheidsindicator";
_t["OK"] = "OK";
_t["Open project"] = "Project openen";
_t["Open..."] = "Openen...";
_t["PDF files"] = "PDF bestanden";
_t["Paste"] = "Plakken";
_t["Print"] = "Afdrukken";
_t["Project details..."] = "Projectdetails...";
_t["Project was not saved"] = "Project is niet opgeslagen";
_t["Quick guide..."] = "Snelgids...";
_t["Quit"] = "Afsluiten";
_t["Raster project"] = "Raster project";
_t["Redo"] = "Opnieuw";
_t["Reset"] = "Herstel";
_t["Save"] = "Opslaan";
_t["Save as PDF"] = "Opslaan als PDF";
_t["Save as PDF..."] = "Opslaan as PDF...";
_t["Save as..."] = "Opslaan als...";
_t["Save changes"] = "Wijzigingen opslaan";
_t["Save project"] = "Project opslaan";
_t["Select all"] = "Alles selecteren";
_t["Show labels"] = "Laat labels zien";
_t["Show mini-map"] = "Laat minimap zien";
_t["Small vulnerability levels"] = "Kleine kwetsbaarheidsindicator";
_t["System notification:"] = "Het systeem meldt:";
_t["There are unsaved changes. If you continue those will be lost."] = "Er zijn wijzigingen die nog niet zijn opgeslagen. Als u doorgaat raken deze verloren.";
_t["Undo"] = "Ongedaan maken";
_t["Update available"] = "Nieuwe versie beschikbaar";
_t["Version"] = "Versie";
_t["Version %% is available; you have version %%."] = "Versie %% is beschikbaar; u heeft versie %%.";
_t["View"] = "Beeld";
_t["Visit the risicotools.nl website to download the latest version."] = "Ga naar risicotools.nl om de laatste versie te downloaden.";
_t["Vulnerability levels"] = "Kwetsbaarheidsindicator";
_t["Window"] = "Venster";
_t["Zoom"] = "Zoom";
_t["Zoom in"] = "Zoom in";
_t["Zoom out"] = "Zoom uit";
