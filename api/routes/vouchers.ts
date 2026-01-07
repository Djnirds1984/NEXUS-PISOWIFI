import express from 'express';
import { voucherManager } from '../voucherManager.js';

const router = express.Router();

// Get all vouchers
router.get('/', (req, res) => {
  try {
    const vouchers = voucherManager.getAllVouchers();
    res.json({
      success: true,
      data: vouchers
    });
  } catch (error) {
    console.error('Error getting vouchers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get vouchers'
    });
  }
});

// Generate vouchers
router.post('/generate', (req, res) => {
  try {
    const { amount, count } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
      });
    }

    if (!count || typeof count !== 'number' || count <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid count is required'
      });
    }

    const vouchers = voucherManager.generateVouchers(amount, count);

    res.json({
      success: true,
      message: `${count} vouchers generated successfully`,
      data: vouchers
    });
  } catch (error) {
    console.error('Error generating vouchers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate vouchers'
    });
  }
});

// Delete voucher
router.delete('/:code', (req, res) => {
  try {
    const { code } = req.params;
    const success = voucherManager.deleteVoucher(code);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Voucher not found'
      });
    }

    res.json({
      success: true,
      message: 'Voucher deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting voucher:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete voucher'
    });
  }
});

export default router;
