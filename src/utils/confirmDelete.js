/**
 * Show a delete confirmation popup that requires user to type 'yes' to confirm
 * @param {string} itemName - Name of the item being deleted
 * @param {string} itemType - Type of item (e.g., 'transaction', 'vendor', 'wire')
 * @returns {boolean} - Returns true if user confirmed, false otherwise
 */
export const confirmDelete = (itemName, itemType = 'item') => {
  const message = `⚠️ Are you sure you want to delete this ${itemType}?\n\n` +
    `${itemName ? `Item: ${itemName}\n\n` : ''}` +
    `This action cannot be undone.\n\n` +
    `Type "yes" (lowercase) to confirm deletion:`;
  
  const userInput = prompt(message);
  
  if (userInput === 'yes') {
    return true;
  } else if (userInput !== null) {
    alert('❌ Deletion cancelled. You must type "yes" exactly to confirm.');
  }
  
  return false;
};
