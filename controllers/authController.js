const passport = require("passport");
const crypto = require("crypto");
const promisify = require("es6-promisify");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const mail = require("../handlers/mail");

exports.login = passport.authenticate("local", {
	failureRedirect: "/login",
	failureFlash: "Failed login",
	successRedirect: "/",
	successFlash: "You are now logged in"
});

exports.logout = (req, res) => {
	req.logout();
	req.flash("success", "You are now logged out 👋");
	res.redirect("/");
};

exports.isLoggedIn = (req, res, next) => {
	// check if user is authenticated
	if (req.isAuthenticated()) return next();
	req.flash("error", "Oops! You must be logged in to do that.");
	res.redirect("/login");
};

exports.forgot = async (req, res) => {
	// 1. See if user exists
	const user = await User.findOne({ email: req.body.email });
	if (!user) {
		req.flash("error", "No account with that email exists"); // probably don't do this for security reasons
		return res.redirect("/login");
	}

	// 2. Set reset token and expiry on account
	user.resetPasswordToken = crypto.randomBytes(20).toString("hex");
	user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
	await user.save();

	// 3. Send email with token
	const resetURL = `http://${req.headers.host}/account/reset/${
		user.resetPasswordToken
	}`;

	await mail.send({
		user,
		subject: "Dang! Password Reset",
		resetURL,
		filename: "password-reset"
	});

	req.flash("success", `You have been emailed a reset code 📫`);

	// 4. Redirect to /login
	res.redirect("/login");
};

exports.reset = async (req, res) => {
	const user = await User.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: { $gt: Date.now() }
	});
	if (!user) {
		req.flash("error", "Reset token is invalid or has expired");
		return res.redirect("/login");
	}
	// if there is a user, show reset form
	res.render("reset", { title: "Reset your password" });
};

exports.confirmedPasswords = (req, res, next) => {
	if (req.body.password === req.body["password-confirm"]) return next();
	req.flash("error", "Passwords do not match 🚫");
	res.redirect("back");
};

exports.update = async (req, res) => {
	// make sure user still exists within expiry
	// this could be abstracted into middleware
	const user = await User.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: { $gt: Date.now() }
	});
	if (!user) {
		req.flash("error", "Reset token is invalid or has expired");
		return res.redirect("/login");
	}
	// if valid, reset password
	const setPassword = promisify(user.setPassword, user); // promisify callback function
	await setPassword(req.body.password);
	user.resetPasswordExpires = undefined;
	user.resetPasswordExpires = undefined;
	const updatedUser = await user.save();
	await req.login(updatedUser);
	req.flash(
		"success",
		"💃Your password has been reset! You are now logged in."
	);
	res.redirect("/");
};
