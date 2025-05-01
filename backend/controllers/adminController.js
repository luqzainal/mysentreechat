import User from '../models/User.js';

// @desc    Dapatkan semua pengguna (oleh Admin)
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
    try {
        // Dapatkan semua pengguna, kecualikan medan kata laluan
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        console.error('Ralat mendapatkan pengguna:', error);
        res.status(500).json({ message: 'Ralat pelayan dalaman' });
    }
};

// @desc    Kemaskini pelan keahlian pengguna (oleh Admin)
// @route   PUT /api/admin/users/:id/plan
// @access  Private/Admin
const updateUserPlan = async (req, res) => {
    try {
        const { plan } = req.body; // Ambil pelan baru dari body
        const userIdToUpdate = req.params.id; // Ambil ID pengguna dari URL

        // Validasi input - pastikan pelan ada dan mungkin jenis yang dibenarkan
        const allowedPlans = ['Free', 'Basic', 'Pro']; // Sesuaikan dengan pelan anda
        if (!plan || !allowedPlans.includes(plan)) {
            return res.status(400).json({ message: 'Pelan tidak sah atau tidak disediakan.' });
        }

        const user = await User.findById(userIdToUpdate);

        if (!user) {
            return res.status(404).json({ message: 'Pengguna tidak ditemui.' });
        }

        // Kemaskini pelan pengguna
        user.membershipPlan = plan;
        await user.save();

        // Kembalikan data pengguna yang dikemaskini (tanpa password)
        const updatedUser = await User.findById(userIdToUpdate).select('-password');
        res.json(updatedUser);

    } catch (error) {
        console.error(`Ralat mengemaskini pelan pengguna ${req.params.id}:`, error);
        // Handle ralat validasi jika ada
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Ralat validasi', errors: error.errors });
        }
        res.status(500).json({ message: 'Ralat pelayan dalaman semasa mengemaskini pelan.' });
    }
};

// @desc    Tukar peranan pengguna (oleh Admin)
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
const changeUserRole = async (req, res) => {
    try {
        const { role } = req.body; // Ambil role baru dari body ('user' atau 'admin')
        const userIdToUpdate = req.params.id; // Ambil ID pengguna dari URL
        const requestingAdminId = req.user._id; // ID admin yang membuat permintaan

        // Validasi input role
        const allowedRoles = ['user', 'admin'];
        if (!role || !allowedRoles.includes(role)) {
            return res.status(400).json({ message: 'Peranan tidak sah. Pilih \'user\' atau \'admin\'.' });
        }

        // Elakkan admin menukar peranannya sendiri melalui endpoint ini
        if (userIdToUpdate === requestingAdminId.toString()) {
             return res.status(400).json({ message: 'Tidak boleh menukar peranan akaun admin sendiri.' });
        }

        const user = await User.findById(userIdToUpdate);

        if (!user) {
            return res.status(404).json({ message: 'Pengguna tidak ditemui.' });
        }

        // Kemaskini role pengguna
        user.role = role;
        // Biarkan pre-save hook uruskan penetapan pelan Pro jika role menjadi 'admin'
        await user.save(); 

        // Kembalikan data pengguna yang dikemaskini (tanpa password)
        const updatedUser = await User.findById(userIdToUpdate).select('-password');
        res.json(updatedUser);

    } catch (error) {
        console.error(`Ralat menukar peranan pengguna ${req.params.id}:`, error);
        res.status(500).json({ message: 'Ralat pelayan dalaman semasa menukar peranan.' });
    }
};

// Kemaskini export untuk masukkan fungsi baru
export { getAllUsers, updateUserPlan, changeUserRole }; 