const mongoose = require("mongoose");
const multer = require("multer");
const jimp = require("jimp");
const uuid = require("uuid");
const Store = mongoose.model("Store");
const User = mongoose.model("User");

const multerOptions = {
	storage: multer.memoryStorage(),
	fileFilter(req, file, next) {
		const isPhoto = file.mimetype.startsWith("image/");
		if (isPhoto) next(null, true);
		else next({ message: "That file type isn't allowed" }, false);
	}
};

exports.homePage = (req, res) => {
	res.render("index");
};

exports.addStore = (req, res) => {
	res.render("editStore", { title: "Add Store" });
};

exports.upload = multer(multerOptions).single("photo");

exports.resize = async (req, res, next) => {
	// check if there is no new file to resize
	if (!req.file) return next(); //skip to next middleware
	const ext = req.file.mimetype.split("/")[1];
	req.body.photo = `${uuid.v4()}.${ext}`;
	// now we resize
	const photo = await jimp.read(req.file.buffer);
	await photo.resize(800, jimp.AUTO);
	await photo.write(`./public/uploads/${req.body.photo}`);
	// once photo is written to file system, keep going!
	next();
};

exports.createStore = async (req, res) => {
	req.body.author = req.user._id;
	const store = await new Store(req.body).save();
	req.flash(
		"success",
		`Successfully created ${store.name}! Care to leave a review?`
	);
	res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
	const page = req.params.page || 1;
	const limit = 6;
	const skip = page * limit - limit;

	// 1. query db for list of all stores
	const storePromise = Store.find()
		.skip(skip)
		.limit(limit)
		.sort({ created: "desc" });

	const countPromise = Store.count();

	const [stores, count] = await Promise.all([storePromise, countPromise]);

	const pages = Math.ceil(count / limit);

	if (!stores.length && skip) {
		req.flash(
			"info",
			`You asked for page ${page} but that doesn't exist. I put you on page ${pages}.`
		);
		res.redirect(`/stores/page/${pages}`);
		return;
	}

	res.render("stores", { title: "Stores", stores, page, pages, count });
};

const confirmOwner = (store, user) => {
	if (!store.author.equals(user._id)) {
		throw Error("You must own a store in order to edit it");
	}
};

exports.editStore = async (req, res) => {
	// 1. find store given id
	const store = await Store.findOne({ _id: req.params.id });
	// 2. confirm owner of store
	confirmOwner(store, req.user);
	// 3. render edit form
	res.render("editStore", { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
	// set the location data to be a 'Point'
	req.body.location.type = "Point";
	// find store and update it
	const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
		new: true, //return new store instead of old one
		runValidators: true // re-runs validators
	}).exec();
	//tell them it worked
	req.flash(
		"success",
		`Successfully updated <strong>${store.name}</strong>. <a href="/stores/${
			store.slug
		}">View store →</a>`
	);
	// redirect to store
	res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
	const store = await Store.findOne({ slug: req.params.slug }).populate(
		"author reviews"
	);
	if (!store) return next();
	res.render("store", { title: store.name, store });
};

exports.getStoresByTag = async (req, res) => {
	const tag = req.params.tag;
	const tagQuery = tag || { $exists: true };

	const tagsPromise = Store.getTagsList();
	const storesPromise = Store.find({ tags: tagQuery });

	const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);

	res.render("tag", { tags, stores, title: "Tags", tag });
};

exports.searchStores = async (req, res) => {
	const stores = await Store
		// find stores that match
		.find(
			{
				$text: {
					$search: req.query.q
				}
			},
			{
				score: { $meta: "textScore" }
			}
		)
		// then sort them
		.sort({
			score: { $meta: "textScore" }
		})
		// limit to 5
		.limit(5);
	res.json(stores);
};

exports.mapStores = async (req, res) => {
	const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
	const q = {
		location: {
			$near: {
				$geometry: {
					type: "Point",
					coordinates
				},
				$maxDistance: 10000 // 10km
			}
		}
	};

	const stores = await Store.find(q)
		.select("slug name description location photo")
		.limit(10);
	res.json(stores);
};

exports.mapPage = (req, res) => {
	res.render("map", { title: "Map" });
};

exports.heartStore = async (req, res) => {
	const hearts = req.user.hearts.map(obj => obj.toString());
	const operator = hearts.includes(req.params.id) ? "$pull" : "$addToSet";
	const user = await User.findByIdAndUpdate(
		req.user._id,
		{
			[operator]: { hearts: req.params.id }
		},
		{ new: true }
	);
	res.json(user);
};

exports.getHearts = async (req, res) => {
	const stores = await Store.find({
		_id: { $in: req.user.hearts }
	});
	res.render("stores", { title: "My Hearts", stores });
};

exports.getTopStores = async (req, res) => {
	const stores = await Store.getTopStores();
	res.render("topStores", { stores, title: "⭐️ Top Stores!" });
};
