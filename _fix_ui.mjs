
import fs from 'fs';

const filePath = 'd:\\BohraShaadi\\dbohranisbat\\src\\components\\RishtaDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove admin messages toggle in banner
const bannerButtonRegex = /<button\s+onClick=\{\(\)\s+=>\s+setShowAdminMessages\(!showAdminMessages\)\}\s+className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex items-center gap-1\.5"\s+>\s+<MessageCircle className="w-3\.5 h-3\.5" \/>\s+\{showAdminMessages \? 'Hide' : 'Message Admin'\}\s+\{adminMsgThread\.length > 0 && <span className="bg-\[#881337\] text-white rounded-full px-1\.5 text-\[9px\]">\{adminMsgThread\.length\}<\/span>\}\s+<\/button>/g;

content = content.replace(/onclick=\{[^}]*setShowAdminMessages[^}]*\}/gi, 'onClick={() => setShowAdminHelpChat(true)}');

// Clean up the text inside that button specifically if possible, or just look for the block
content = content.replace(/\{showAdminMessages \? 'Hide' : 'Message Admin'\}\s+\{adminMsgThread\.length > 0 && <span className="bg-\[#881337\] text-white rounded-full px-1\.5 text-\[9px\]">\{adminMsgThread\.length\}<\/span>\}/g, 'Message Admin');

// 2. Add action buttons to Hold notification
const holdMatch = /\{myProfile\?.status === 'hold' && \([\s\S]*?<p className="text-gray-700 text-sm mt-1">Your profile is temporarily on hold pending admin review\.<\/p>\s+\{myProfile\.adminMessage && <p className="mt-2 italic text-yellow-700 text-sm bg-white border border-yellow-100 px-3 py-2 rounded-xl">💬 "\{myProfile\.adminMessage\}"<\/p>\}\s+<\/div>/g;

const holdReplacement = `{myProfile?.status === 'hold' && (
                            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-5 shadow-sm flex gap-4 items-start">
                                <div className="text-3xl shrink-0">⏸️</div>
                                <div className="flex-1">
                                    <p className="font-black text-yellow-800 text-base">Profile On Hold</p>
                                    <p className="text-gray-700 text-sm mt-1">Your profile is temporarily on hold pending admin review.</p>
                                    {myProfile.adminMessage && <p className="mt-2 italic text-yellow-700 text-sm bg-white border border-yellow-100 px-3 py-2 rounded-xl">💬 "{myProfile.adminMessage}"</p>}
                                    <div className="flex gap-3 mt-3">
                                        <button onClick={() => setShowAdminHelpChat(true)} className="bg-yellow-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-yellow-700 transition-all flex items-center gap-1.5">
                                            <MessageCircle className="w-3.5 h-3.5" /> Message Admin
                                        </button>
                                        <button onClick={() => router.push('/candidate-registration')} className="bg-white border border-yellow-300 text-yellow-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-yellow-50 transition-all">
                                            ✏️ View Profile
                                        </button>
                                    </div>
                                </div>`;

// Using a simpler approach for Hold replacement to avoid regex issues
const holdSearchStr = `<p className="font-black text-yellow-800 text-base">Profile On Hold</p>
                                    <p className="text-gray-700 text-sm mt-1">Your profile is temporarily on hold pending admin review.</p>
                                    {myProfile.adminMessage && <p className="mt-2 italic text-yellow-700 text-sm bg-white border border-yellow-100 px-3 py-2 rounded-xl">💬 "{myProfile.adminMessage}"</p>}`;

if (content.includes(holdSearchStr)) {
    content = content.replace(holdSearchStr, holdSearchStr + `
                                    <div className="flex gap-3 mt-3">
                                        <button onClick={() => setShowAdminHelpChat(true)} className="bg-yellow-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-yellow-700 transition-all flex items-center gap-1.5">
                                            <MessageCircle className="w-3.5 h-3.5" /> Message Admin
                                        </button>
                                        <button onClick={() => router.push('/candidate-registration')} className="bg-white border border-yellow-300 text-yellow-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-yellow-50 transition-all">
                                            ✏️ View Profile
                                        </button>
                                    </div>`);
}

fs.writeFileSync(filePath, content);
console.log('Successfully updated RishtaDashboard.tsx');
