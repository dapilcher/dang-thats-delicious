function autocomplete(input, latInput, lngInput) {
	if (!input) return; // skip fn if no input on page
	const dropdown = new google.maps.places.Autocomplete(input);

	dropdown.addListener("place_changed", () => {
		const place = dropdown.getPlace();
		latInput.value = place.geometry.location.lat();
		lngInput.value = place.geometry.location.lng();
	});

	// if someone hits enter on address form, do not submit
	input.on("keydown", e => {
		if (e.keycode === 13) e.preventDefault();
	});
}

export default autocomplete;
