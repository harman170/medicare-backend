const User = require('../models/UserModel');

//  Signup
exports.signup = async(req, res) => {
    const { email, password, usertype } = req.body;

    try {
        const user = new User({ email, password, usertype });
        await user.save();


        res.json({ status: true, msg: 'Signup successful!' });
    } catch (err) {
        res.json({ status: false, msg: 'Signup failed.' });
    }
};

//  Login
exports.login = async(req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email, password });

        if (!user)
            return res.json({ status: false, msg: 'Invalid credentials' });

        if (user.status === 'block')
            return res.json({ status: false, msg: 'You are blocked by admin' });

        res.json({ status: true, msg: 'Login success', usertype: user.usertype });
    } catch (err) {
        res.json({ status: false, msg: 'Server error' });
    }
};

//  Forgot Password
exports.forgotPassword = async(req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user)
            return res.json({ status: false, msg: 'Email not found' });

        res.json({ status: true, password: user.password });
    } catch (err) {
        res.json({ status: false, msg: 'Server error' });
    }
};