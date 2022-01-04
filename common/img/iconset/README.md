# Iconset Description
Each iconset should be stored in its own directory inside the `iconset` directory.
The name of the directory should match the name of the iconset.
The iconset must contain a description in JSON format; the file must be called `iconset.json`; e.g. for iconset `medical` the description must be stored in `iconset/medical/iconset.json`. See below for the definition of the the `iconset.json` file.

Icons have a type (either wired link, wireless link, equipment, unknown link or actor). There must be one or more icons for each type. 
For each icon there must be two files: the icon and its icon mask. If no mask is specified, the mask is assumed to have the same name as its icon but with `-mask` appended (and with the same extension). 
In addition to the icon and the mask, the first icon of each type must specify the template-image (the user drags the template from the toolbar onto the workspace to create new nodes). If no template image is specified, then the name is assumed to be the icon name with `-template` appended.
 
E.g;
* icon `machine.png` will have the default mask `machine-mask.png`, and the default template will be `machine-template.png`.
* icon `tube.jpeg` will have the default mask `tube-mask.jpeg`, and the default template will be `tube-template.jpeg`.

Files for icons, masks and templates may be stored in the iconset directory (at the same level as `iconset.json`) or in subdirectories.

## Creating icons and masks
Icon and mask images typically have transparent areas. The icon is displayed on a colored background. Some areas of the icon will have the background color. The mask image determined the extent and size of the background. Non-transparent areas of the mask will take the background color, transparent areas of the mask will remain transparent. The icon is drawn on top of its background.

* Outlines and areas that must always be visible in the foreground color: include these in the icon.
* Areas that should be visible in the background color: make these transparent in the icon, and non-transparent in the mask.
* Areas that should always be transparent: make these transparent in the icon *and* in its mask.

## iconset.json
This must be a valid JSON file, containing a single object. Some of the (sub-)fields are multi-language strings. Multi-language strings are objects in with property names are (capitalized) language codes, and property values are the string in that language.
E.g. `{"EN": "This is an example", "NL": "Dit is een voorbeeld"}`
Fields are mandatory, unless specified as optional.

### Fields
1. `setDescription`: Multilanguage string (optional), a phrase describing this iconset.
2. `icons`: Array of icon descriptions; see below.

The first five icons in the array *must* be of types tEQT, tWRD, tWLS, tUNK, tACT, in that order. Any additional icons must be specified after these five.

### Icon descriptions
1. `type`: String, one of tWLS, tWRD, tEQT, tUNK, tACT.
2. `image`: String, the name of the image file. 
3. `mask`: String (optional), the name of the mask file. Default = derived from the image filename.
4. `template`: String (optional), the name of an image file that can be used as the template image. Default = derived from the image filename.
5. `name`: Multi-language string (optional), description of this icon. Default = image filename.
6. `width`: integer (optional), the default width of the icon in pixels. Default = 100. Allowed range is 20..200
7. `height`: integer (optional), the default height of the icon in pixels. Default = 30. Allowed range is 10..100
8. `title`: String (optional), location of the title, one of `inside`, `below`, `topleft`. Inside: the title is centered horizontally and vertically within the icon. Below: the title is drawn centered and below the icon. Topleft: the title is aligned to the left margin, and vertically aligned at the top. Default = `inside`.
9. `margin`: String (optional), left and right margin of the title as a percentage of the icon width. Does not apply when title = below. Increase the margin to fit the title inside the icon. Default = 0.
10. `offsetConnector`: real number between 0.00 and 1.00 (optional). The connector is always drawn at the top of the icon; this offset specifies its horizontal location: 0.00 means at the extreme left, 0.5 means centered, 1,0 means at the extreme right. Default = 0.5.
11. `maintainAspect`: boolean (optional). If false, the width and height can be adjusted independently. Default = true.

Make sure that `iconset.json` is a valid JSON file. Raster will report parsing errors in the Developer tools|Console.
