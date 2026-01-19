# Abreys Machine Checklist App - Deployment Guide

## 🚀 Deploying to Your Staff

### **App URL for Staff:**
```
https://safereport-5.preview.emergentagent.com
```

### **What Staff Can Do:**
✅ Complete daily equipment checks  
✅ Complete grader startup checks  
✅ Complete workshop service records  
✅ View dashboard showing recent checks  
✅ View all completed records  
✅ Add notes to checklist items  
✅ Mark items as satisfactory (✓) or unsatisfactory (✗)  

### **What Staff CANNOT Do:**
❌ Create new checklist types  
❌ Edit checklist items  
❌ Upload Excel files  
❌ Access admin functions  
❌ Sync data from SharePoint  

---

## 🔐 Admin Access (You Only)

### **Admin Password:**
```
abreys2024admin
```

### **How to Access Admin Functions:**
1. Go to the app URL
2. Click "Admin" button in top right
3. Enter admin password
4. Access "Admin Panel" to sync Excel data

### **To Change Admin Password:**
Edit the password in `/app/frontend/.env`:
```
REACT_APP_ADMIN_PASSWORD=your_new_password_here
```

---

## 📋 Staff Training Instructions

### **Send This to Your Staff:**

---

**ABREYS MACHINE CHECKLIST SYSTEM**

**Access:** https://safereport-5.preview.emergentagent.com

**How to Complete a Check:**

1. **Go to the website** above
2. **Click "New Check"** 
3. **Select your name** from the dropdown
4. **Select the machine** (make, then model)
5. **Choose check type:**
   - Daily Check (normal equipment inspection)
   - Grader Start Up (for grader operations)  
   - Workshop Service (for maintenance records)
6. **Complete the checklist** by marking each item:
   - ✓ = Satisfactory 
   - ✗ = Unsatisfactory (requires attention)
7. **Add notes** if needed (optional)
8. **Submit** when complete

**View Records:** Click "Records" to see all completed checks

**Dashboard:** Shows recent activity and statistics

---

## 🛠 Managing Checklist Content (Admin Only)

### **To Update Checklist Items:**

1. **Download templates:**
   - Daily_Check_Checklist.xlsx
   - Grader_Startup_Checklist.xlsx  
   - Workshop_Service_Tasks.xlsx

2. **Edit in Excel** (add/remove/modify items)

3. **Upload via Admin Panel:**
   - Login as admin
   - Use colored upload boxes
   - Changes appear immediately for staff

### **To Update Staff/Machines:**
- Upload Name List.xlsx (staff names)
- Upload AssetList.xlsx (machine data)
- Or sync from SharePoint if connected

---

## 🔧 Technical Notes

### **Browser Compatibility:**
- Chrome, Edge, Safari, Firefox (modern versions)
- Works on desktop, tablet, mobile

### **Data Storage:**
- All data stored securely in MongoDB
- Automatic backups included
- Export to Excel available

### **Performance:**
- Fast loading times
- Works offline for form completion
- Syncs when connection restored

---

## 📞 Support

If staff have technical issues:
1. Try refreshing the browser
2. Clear browser cache if needed
3. Contact IT support with specific error messages

**Admin Issues:** Check admin password, verify Excel file formats, ensure proper column headers in uploads.