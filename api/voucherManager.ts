import { 
  addVoucher, 
  getVoucher, 
  updateVoucher, 
  deleteVoucher, 
  getVouchers, 
  Voucher,
  getSettings 
} from './database.js';
import { sessionManager } from './sessionManager.js';

class VoucherManager {
  /**
   * Generate a random voucher code
   */
  private generateCode(length: number = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars like I, 1, O, 0
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate multiple vouchers
   */
  generateVouchers(amount: number, count: number): Voucher[] {
    const vouchers: Voucher[] = [];
    
    for (let i = 0; i < count; i++) {
      let code = this.generateCode();
      // Ensure uniqueness (though collision is unlikely)
      while (getVoucher(code)) {
        code = this.generateCode();
      }

      const voucher: Voucher = {
        code,
        amount,
        isUsed: false,
        dateGenerated: new Date().toISOString()
      };

      addVoucher(voucher);
      vouchers.push(voucher);
    }

    return vouchers;
  }

  /**
   * List all vouchers
   */
  getAllVouchers(): Voucher[] {
    return getVouchers();
  }

  /**
   * Delete a voucher
   */
  deleteVoucher(code: string): boolean {
    if (!getVoucher(code)) return false;
    deleteVoucher(code);
    return true;
  }

  /**
   * Redeem a voucher
   */
  async redeemVoucher(code: string, macAddress: string): Promise<{ success: boolean; message: string; session?: any }> {
    const voucher = getVoucher(code);

    if (!voucher) {
      return { success: false, message: 'Invalid voucher code' };
    }

    if (voucher.isUsed) {
      return { success: false, message: 'Voucher already used' };
    }

    // Check for active session to extend, or start new
    let session = sessionManager.getSession(macAddress);
    
    // Calculate minutes based on amount (pesos)
    const settings = getSettings();
    let minutes = 0;
    
    // Find rate for this amount
    const rate = settings.rates.rates.find(r => r.pesos === voucher.amount);
    if (rate) {
      minutes = rate.minutes;
    } else {
      // Fallback to timePerPeso
      minutes = voucher.amount * settings.rates.timePerPeso;
    }

    try {
      if (session && session.active) {
        // Extend existing session
        await sessionManager.extendSession(macAddress, minutes);
        session = sessionManager.getSession(macAddress); // Refresh session data
      } else {
        // Start new session
        session = await sessionManager.startSession(macAddress, voucher.amount);
        // Note: startSession uses amount to calculate minutes again, 
        // we might need to ensure consistency if logic differs. 
        // startSession implementation in sessionManager handles minute calculation from pesos.
        // But startSession takes 'pesos' as argument.
      }

      // Mark voucher as used
      updateVoucher(code, {
        isUsed: true,
        dateUsed: new Date().toISOString()
      });

      return { 
        success: true, 
        message: `Voucher redeemed successfully! Added ${minutes} minutes.`,
        session 
      };
    } catch (error) {
      console.error('Error redeeming voucher:', error);
      return { success: false, message: 'Failed to redeem voucher' };
    }
  }
}

export const voucherManager = new VoucherManager();
