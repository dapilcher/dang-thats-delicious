const mongoose = require("mongoose");
const promisify = require("es6-promisify");
const User = mongoose.model("User");

exports.loginForm = (req, res) => {
	res.render("login", { title: "Login" });
};

exports.registerForm = (req, res) => {
	res.render("register", { title: "Register" });
};

exports.validateRegister = (req, res, next) => {
	req.sanitizeBody("name");
	req.checkBody("name", "You must supply a name!").notEmpty();
	req.checkBody("email", "That email is not valid!").isEmail();
	req.sanitizeBody("email").normalizeEmail({
		remove_dots: false,
		remove_extension: false,
		gmail_remove_subaddress: false
	});
	req.checkBody("password", "Password cannot be blank!").notEmpty();
	req
		.checkBody("password-confirm", "Confirmed password cannot be blank!")
		.notEmpty();
	req
		.checkBody("password-confirm", "Oops! Passwords do not match!")
		.equals(req.body.password);

	const errors = req.validationErrors();
	if (errors) {
		req.flash("error", errors.map(err => err.msg));
		res.render("register", {
			title: "Register",
			body: req.body,
			flashes: req.flash()
		});
		return; // stop fn from running
	}

	next(); // there were no errors!
};

exports.register = async (req, res, next) => {
	const user = new User({ email: req.body.email, name: req.body.name });
	// User.register(user, req.body.password, function(err, user) {})
	const register = promisify(User.register, User);
	await register(user, req.body.password);
	next(); // pass to authController.login
};

exports.account = (req, res) => {
	res.render("account", { title: "Edit your account" });
};

exports.updateAccount = async (req, res) => {
	const updates = {
		name: req.body.name,
		email: req.body.email
	};
	const user = await User.findOneAndUpdate(
		{ _id: req.user._id }, //query
		{ $set: updates }, //updates
		{ new: true, runValidators: true, context: "query" } //options
	);
	req.flash("success", "Account successfully updated 👍");
	res.redirect("back");
};
