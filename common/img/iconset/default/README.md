# Iconset Description
Each iconset should be stored in its own directory inside the 'iconset' directory.
The name of the directory should match the name of the iconset; e.g. all files for iconset 'medical' should be stored in 'img/iconset/medical'.
The iconset must contain a description in JSON format; the file must be called 'iconset.json'.
For each icon there must be two files: the icon and an icon mask; the mask must have the same name as its corresponding icon but with '-mask' appended, and must have the same extension.
E.g;
* icon "machine.png" must have mask "machine-mask.png"
* icon "tube.jpeg" must have mask "tube-mask.jpeg"

## iconset.json
This must be a valid JSON file, containing a single object with three fields. Some of the (sub-)fields are multi-language strings. Multi-language strings are objects in with property names are (capitalized) language codes, and property values are the string in that language.
E.g. {"EN": "This is an example", "NL": "Dit is een voorbeeld"}
All fields are mandatory, unless they are specified as optional.

Fields:
1. setName: String, the name of this iconset.
2. setDescription: Multilanguage string (optional), a phrase describing this iconset.
3. icons: Array of icon descriptions.

Icon descriptions:
1. type: String, one of tWLS, tWRD, tEQT, tUNK, tACT, tNOT.
2. image: String, the name of the image file. The name of the mask is derived from this.
3. name: Multi-language string (optional), description of this icon. Default = image filename.
4. width: integer (optional), the default width of the icon in pixels. Default = 100.
5. height: integer (optional), the default height of the icon in pixels. Default = 30.
6. title: String (optional), location of the title, one of "inside", "below", "topleft". Inside means that the title is centered within the icon. Below means that the title is drawn outside and below the icon. Topleft is similar to inside, but the text is aligned to the left margin, and vertically aligned at the top (suitable for Notes). Default = inside.
7. margin: String (optional), left and right margin of the title as a percentage of the icon width. Does not apply when title = below. Increase the margin to fit the title inside the icon. Default = 0.
8. offsetConnector: float between 0.00 and 1.00 (optional). The connector is always drawn at the top of the icon; this offset specifies its horizontal location: 0.00 means at the extreme left, 0.5 means centered, 1,0 means at the extreme right. Default = 0.5.
9. maintainAspect: boolean (optional). If false, the width and height can be adjusted independently. Default = true.
