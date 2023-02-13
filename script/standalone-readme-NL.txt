Als u deze Schijfkopie heeft gedownload van het internet dan moet u de Raster app
handmatig ontgrendelen voordat u het kan gebruiken. Als u dat niet doet, zal uw Mac
klagen dat het bestand is beschadigd, en zelfs voorstellen het naar de Prullenmand
te verplaatsen.

Volg deze drie stappen om te ontgrendelen:

1. Sleep de Raster.app vanuit de Schijfkopie naar uw Bureaublad.
2. Start de Terminal app. U vindt deze in Apps, in de map Hulpprogramma's.
3. In het Terminal scherm tiept u deze tekst (of knip & plak):

	xattr -d com.apple.quarantine ~/Desktop/Raster.app

U kunt nu de Raster app opstarten, en u kunt de app naar Apps verplaatsen als u
dat wenst.
