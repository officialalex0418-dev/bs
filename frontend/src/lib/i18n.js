const translations = {
  Nepali: {
    'Total Staff': 'कुल कर्मचारी',
    'Active Staff': 'सक्रिय कर्मचारी',
    'Checked-In Today': 'आज चेक-इन भएका',
    'Monthly Attendance': 'मासिक हाजिरी',
    'Daily Sales': 'दैनिक बिक्री',
    'Monthly Sales': 'मासिक बिक्री',
    'Recent Activities': 'हालैका गतिविधिहरू',
    'Settings': 'सेटिङहरू',
    'Profile': 'प्रोफाइल',
    'Dashboard': 'ड्यासबोर्ड',
    'Inventory': 'इन्भेन्टरी',
    'Distributors': 'वितरकहरू',
    'Reports': 'रिपोर्टहरू',
    'Logout': 'लगआउट',
    'Location tracking active': 'स्थान ट्र्याकिङ सक्रिय छ',
    'Check In': 'चेक इन',
    'Check Out': 'चेक आउट',
    'Attendance': 'हाजिरी',
    'Apply Leave': 'बिदाको लागि आवेदन दिनुहोस्',
    'Employee': 'कर्मचारी',
    'Live Tracking': 'प्रत्यक्ष ट्र्याकिङ',
    'Attendance Management': 'हाजिरी व्यवस्थापन',
    'Leave Management': 'बिदा व्यवस्थापन',
    'Sales Tracker': 'बिक्री ट्र्याकर',
    'Payroll Management': 'तलब व्यवस्थापन',
    'Complaints': 'गुनासोहरू',
    'Configuration': 'कन्फिगरेसन',
    'System Employees': 'प्रणाली कर्मचारीहरू',
    'Audit Logs': 'अडिट लगहरू',
    'My Payroll': 'मेरो तलब',
    'Profile': 'प्रोफाइल',
    'Sales Entry': 'बिक्री प्रविष्टि',
  },
  English: {} // Default
};

export const t = (text, language = 'English') => {
  if (language === 'English') return text;
  return translations[language]?.[text] || text;
};
