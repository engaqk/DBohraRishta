import { appendFileSync } from 'fs';

const tail = `

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 pb-safe flex justify-around items-center z-50 shadow-2xl">
                <button onClick={() => setActiveTab('mybiodata')} className={\`flex flex-col items-center gap-0.5 transition-colors \${activeTab === 'mybiodata' ? 'text-[#881337]' : 'text-gray-400'}\`}>
                    <ShieldCheck className="w-5 h-5" /><span className="text-[9px] font-bold uppercase">My Biodata</span>
                </button>
                <button onClick={() => setActiveTab('discovery')} className={\`flex flex-col items-center gap-0.5 transition-colors \${activeTab === 'discovery' ? 'text-[#881337]' : 'text-gray-400'}\`}>
                    <Heart className="w-5 h-5" /><span className="text-[9px] font-bold uppercase">Discover</span>
                </button>
                <button onClick={() => setActiveTab('requests')} className={\`flex flex-col items-center gap-0.5 transition-colors \${activeTab === 'requests' ? 'text-[#881337]' : 'text-gray-400'}\`}>
                    <ShieldCheck className="w-5 h-5" /><span className="text-[9px] font-bold uppercase">Requests</span>
                </button>
                <button onClick={() => setActiveTab('messages')} className={\`flex flex-col items-center gap-0.5 transition-colors relative \${activeTab === 'messages' ? 'text-[#881337]' : 'text-gray-400'}\`}>
                    <MessageCircle className="w-5 h-5" /><span className="text-[9px] font-bold uppercase">Chats</span>
                    {allRequests.filter(r => r.status === 'accepted' && r.isIncoming).length > 0 && <span className="absolute -top-0.5 right-3 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                </button>
            </nav>

            {/* Premium Modal */}
            {showPremiumModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white max-w-sm w-full rounded-3xl overflow-hidden shadow-2xl">
                        <div className="bg-gradient-to-r from-[#D4AF37] to-[#F1D16A] p-6 text-center relative">
                            <button onClick={() => setShowPremiumModal(false)} className="absolute top-4 right-4 bg-black/10 rounded-full p-2 text-[#881337]"><X className="w-4 h-4" /></button>
                            <Sparkles className="w-12 h-12 text-[#881337] mx-auto mb-3" />
                            <h2 className="text-2xl font-bold text-[#881337] font-serif mb-1">Unlock Halal Chats</h2>
                            <p className="text-[#881337] opacity-90 text-sm font-medium">Unlimited Matches &amp; Chat</p>
                        </div>
                        <div className="p-8 text-center space-y-6">
                            <h3 className="text-4xl font-extrabold text-[#881337] flex justify-center items-start"><span className="text-xl mt-1">&#8377;</span>53<span className="text-base text-gray-500 font-normal mt-auto mb-1">/mo</span></h3>
                            <ul className="text-left text-sm text-gray-600 space-y-3 font-medium">
                                <li className="flex gap-2"><Check className="w-5 h-5 text-emerald-500 shrink-0" /> Encrypted end-to-end chat</li>
                                <li className="flex gap-2"><Check className="w-5 h-5 text-emerald-500 shrink-0" /> Dynamic profile photo unblurring</li>
                                <li className="flex gap-2"><Check className="w-5 h-5 text-emerald-500 shrink-0" /> See who viewed your profile</li>
                            </ul>
                            <button onClick={handleUpgradeToPremium} disabled={paying} className="w-full bg-[#881337] hover:bg-[#9F1239] text-white py-4 rounded-xl font-bold shadow-md flex justify-center items-center gap-2">
                                {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5" /> Pay Now (Mock)</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* My Profile Preview Modal */}
            {showMyProfileModal && myProfile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowMyProfileModal(false)}>
                    <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="relative h-48 bg-gray-200 overflow-hidden shrink-0">
                            {myProfile.libasImageUrl ? <img src={myProfile.libasImageUrl} alt="Profile" className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-80" /> : <div className="absolute inset-0 bg-gray-300" />}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20" />
                            <button onClick={() => setShowMyProfileModal(false)} className="absolute top-4 right-4 bg-black/40 text-white rounded-full p-2 z-20"><X className="w-4 h-4" /></button>
                            <div className="absolute bottom-6 left-6 z-10">
                                <h2 className="text-3xl font-bold font-serif text-white">{myProfile.name}, {myProfile.dob ? Math.floor((Date.now() - new Date(myProfile.dob).getTime()) / 31557600000) : '--'}</h2>
                                <p className="text-[#D4AF37] font-medium flex items-center gap-2 mt-1"><CheckCircle className="w-4 h-4" /> {myProfile.isItsVerified ? 'ITS Verified' : 'Unverified'}</p>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100"><p className="text-gray-400 text-xs font-bold mb-1">Jamaat</p><p className="text-[#881337] font-semibold text-sm">{myProfile.jamaat || 'N/A'}</p></div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100"><p className="text-gray-400 text-xs font-bold mb-1">Location</p><p className="text-[#881337] font-semibold text-sm">{myProfile.hizratLocation || 'N/A'}</p></div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2"><p className="text-gray-400 text-xs font-bold mb-1">Profession</p><p className="text-[#881337] font-semibold text-sm">{myProfile.professionType || myProfile.profession || 'N/A'}</p></div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2"><p className="text-gray-400 text-xs font-bold mb-1">Hobbies</p><p className="text-[#881337] font-semibold text-sm">{myProfile.hobbies || 'Not specified'}</p></div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2"><p className="text-gray-400 text-xs font-bold mb-1">Partner Qualities</p><p className="text-[#881337] font-semibold text-sm">{myProfile.partnerQualities || 'Not specified'}</p></div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
                                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-blue-700">Photos and contact info remain blurred until an interest is mutually accepted.</p>
                            </div>
                        </div>
                        <div className="p-5 border-t shrink-0">
                            <button onClick={() => { setShowMyProfileModal(false); router.push('/candidate-registration'); }} className="w-full py-3 rounded-xl font-bold bg-[#D4AF37] text-white hover:bg-[#c29e2f]">Edit Profile Details</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Accept Request Modal */}
            {acceptingRequest && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
                        <h3 className="text-2xl font-bold font-serif text-[#881337] mb-2">Accept Interest Request</h3>
                        <p className="text-sm text-gray-600 mb-6">Accepting from <span className="font-bold">{acceptingRequest.otherUserName}</span>. Confirm contact details to share.</p>
                        <div className="space-y-4 mb-6">
                            {acceptError && <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-100">{acceptError}</div>}
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Mobile Number *</label><input value={acceptMobile} onChange={e => { setAcceptMobile(e.target.value); setAcceptError(''); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]" placeholder="e.g. +91 9876543210" /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Email Address *</label><input type="email" value={acceptEmail} onChange={e => { setAcceptEmail(e.target.value); setAcceptError(''); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]" placeholder="e.g. you@example.com" /></div>
                            <div className="flex gap-2 bg-red-50 p-3 rounded-lg border border-red-100">
                                <Info className="w-4 h-4 text-[#881337] shrink-0 mt-0.5" /><p className="text-xs text-[#881337] font-medium">These details will be shared mutually upon acceptance.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setAcceptingRequest(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                            <button onClick={confirmAcceptRequest} className="flex-1 py-3 bg-[#D4AF37] text-white font-bold rounded-xl hover:bg-[#c29e2f] shadow-md">Confirm &amp; Accept</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
`;

appendFileSync('src/components/RishtaDashboard.tsx', tail, 'utf8');
console.log('Done — closing content appended.');
