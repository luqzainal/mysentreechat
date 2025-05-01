import AutoresponderSetting from '../models/AutoresponderSetting.js';

// @desc    Dapatkan tetapan autoresponder pengguna
// @route   GET /autoresponder/settings
// @access  Private
const getAutoresponderSettings = async (req, res) => {
  try {
    // Cari tetapan berdasarkan ID pengguna yang log masuk (dari middleware protect)
    // Jika tiada, cipta rekod baru dengan nilai default
    let settings = await AutoresponderSetting.findOne({ user: req.user._id });

    if (!settings) {
      settings = await AutoresponderSetting.create({
        user: req.user._id,
        // Nilai default lain akan diambil dari schema
      });
    }

    res.json(settings);
  } catch (error) {
    console.error("Ralat mendapatkan tetapan autoresponder:", error);
    res.status(500).json({ message: 'Ralat pelayan semasa mendapatkan tetapan.' });
  }
};

// @desc    Kemaskini tetapan autoresponder pengguna
// @route   PUT /autoresponder/settings
// @access  Private
const updateAutoresponderSettings = async (req, res) => {
  const { isEnabled, openaiApiKey, prompt } = req.body;

  try {
    // Cari dan kemaskini tetapan, atau cipta jika tiada (upsert)
    const settings = await AutoresponderSetting.findOneAndUpdate(
      { user: req.user._id }, // Cari berdasarkan user ID
      {
        $set: { // Guna $set untuk kemaskini field yang diberikan sahaja
          isEnabled: isEnabled,
          openaiApiKey: openaiApiKey,
          prompt: prompt,
        }
      },
      {
        new: true, // Kembalikan dokumen yang telah dikemaskini
        upsert: true, // Cipta dokumen baru jika tiada yang sepadan
        runValidators: true, // Pastikan validasi schema dijalankan
        setDefaultsOnInsert: true, // Guna default schema jika cipta baru
      }
    );

    res.json(settings);

  } catch (error) {
    console.error("Ralat mengemaskini tetapan autoresponder:", error);
    // Handle validation errors specifically if needed
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Data tidak sah', errors: error.errors });
    }
    res.status(500).json({ message: 'Ralat pelayan semasa mengemaskini tetapan.' });
  }
};

// @desc    Tambah saved response
// @route   POST /autoresponder/responses
// @access  Private
const addSavedResponse = async (req, res) => {
    try {
        const userId = req.user._id;
        const { response } = req.body;

        if (!response || typeof response !== 'string' || response.trim() === '') {
            return res.status(400).json({ message: "Respons tidak boleh kosong." });
        }

        const settings = await AutoresponderSetting.findOneAndUpdate(
            { user: userId },
            { $addToSet: { savedResponses: response.trim() } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json(settings.savedResponses);

    } catch (error) {
        console.error("Ralat menambah saved response:", error);
        res.status(500).json({ message: "Ralat pelayan dalaman" });
    }
};

// @desc    Padam saved response
// @route   DELETE /autoresponder/responses
// @access  Private
const removeSavedResponse = async (req, res) => {
    try {
        const userId = req.user._id;
        // Ambil respons untuk dipadam dari URL params atau query string
        // Kita guna query string "?response=..." sebab respons mungkin panjang/ada special char
        const { response } = req.query; 

        if (!response) {
            return res.status(400).json({ message: "Sila berikan respons untuk dipadam." });
        }

        const settings = await AutoresponderSetting.findOneAndUpdate(
            { user: userId },
            // Guna $pull untuk memadam item dari array
            { $pull: { savedResponses: response } },
            { new: true } // Tidak perlu upsert di sini
        );

        if (!settings) {
             return res.status(404).json({ message: "Tetapan autoresponder tidak dijumpai." });
        }

        res.json(settings.savedResponses); // Kembalikan senarai terkini

    } catch (error) {
        console.error("Ralat memadam saved response:", error);
        res.status(500).json({ message: "Ralat pelayan dalaman" });
    }
};

export { getAutoresponderSettings, updateAutoresponderSettings, addSavedResponse, removeSavedResponse }; 