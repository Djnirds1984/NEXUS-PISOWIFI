import { 
  addVoucher, 
  getVoucher, 
  updateVoucher, 
  deleteVoucher, 
  getVouchers, 
  Voucher,
  getSettings,
  getDB
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
  async redeemVoucher(code: string, macAddress: string, ipAddress?: string): Promise<{ success: boolean; message: string; session?: any }> {
    // 1. Initial Validation
    const voucher = getVoucher(code);

    if (!voucher) {
      return { success: false, message: 'Invalid voucher code' };
    }

    if (voucher.isUsed) {
      return { success: false, message: 'Voucher already used' };
    }

    // Check for active session to extend, or start new
    // Try to find session by MAC first, then by IP if provided
    let session = sessionManager.getSession(macAddress);
    if (!session && ipAddress) {
       session = sessionManager.getSessionByIp(ipAddress);
       if (session) {
         // Update the MAC address in the request context to match the session
         macAddress = session.macAddress;
       }
    }
    
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
      const dbi = getDB();
      let updatedSession: any;
      let isExtension = false;

      // 2. Transaction: Mark Voucher Used + Create/Update Session Record
      const transaction = dbi.transaction(() => {
         // Re-check voucher status inside transaction for safety (concurrency)
         const currentVoucher = getVoucher(code);
         if (!currentVoucher || currentVoucher.isUsed) {
             throw new Error('Voucher invalid or already used');
         }

         // Mark voucher as used
         updateVoucher(code, { 
            isUsed: true, 
            dateUsed: new Date().toISOString() 
         });
         
         if (session && session.active) {
            isExtension = true;
            // Extend existing session DB record
            updatedSession = sessionManager.extendSessionDB(session.macAddress, minutes);
         } else {
            // Start new session DB record
            updatedSession = sessionManager.startSessionDB(macAddress, voucher.amount, ipAddress);
         }
      });

      // Execute transaction
      transaction();

      // 3. Post-Transaction: Update memory/network
      // If we are here, DB is updated. Now update memory/network.
      if (updatedSession) {
          await sessionManager.syncSessionState(updatedSession);
          
          if (isExtension && ipAddress) {
              sessionManager.updateIpMapping(updatedSession.macAddress, ipAddress);
          }
      }

      return { 
        success: true, 
        message: `Voucher redeemed successfully! Added ${minutes} minutes.`,
        session: updatedSession
      };
    } catch (error: any) {
      console.error('Error redeeming voucher:', error);
      return { success: false, message: error.message || 'Failed to redeem voucher' };
    }
  }
}

export const voucherManager = new VoucherManager();
