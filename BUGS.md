# Major bugs:
✅​ Text layer is not correctly resized accordingly to the zoom (the highlight box is correctly resized, it only affect the text layer, meaning i cannot correctly select text when zoomed)
✅ Nothing happen when clicking a highlighted text: it should show the corresponding annotation in the Annotation panel

# Performance Issues:
✅ The PDF quality is low, we should render the PDF in high quality.
✅ Right now no text selection allowed until the PDF is not fully loaded, sometimes freeze with large documents. If possible, i would recomment to load the text layer toghether with the PDF. Meaning that if the PDF lazy load the first three pages, the text layer should do the same.