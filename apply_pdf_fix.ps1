$path = "d:\BohraShaadi\dbohranisbat\src\components\RishtaDashboard.tsx"
$content = Get-Content $path -Raw

# 1. Add handleSharePDFBiodata inside the component
$newFunc = @"
    const handleSharePDFBiodata = async () => {
        if (!biodataRef.current || !user || !myProfile) return;
        setGeneratingBiodata(true);
        try {
            const { toPng } = await import('html-to-image');
            const { jsPDF } = await import('jspdf');

            const dataUrl = await toPng(biodataRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: '#ffffff'
            });

            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            const pdfBlob = pdf.output('blob');
            const fileName = \`Biodata_\${myProfile.name?.replace(/\s+/g, '_') || 'Candidate'}.pdf\`;
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            const shareUrl = \`\${window.location.origin}/profile?id=\${user.uid}\`;
            const shareText = \`Assalamu Alaiykum! Check out my official Digital Biodata on 53DBohraRishta Community:\n\n🔗 View Online: \${shareUrl}\`;

            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    files: [pdfFile],
                    text: shareText,
                    title: \`Biodata - \${myProfile.name}\`
                }).catch(() => {});
            } else {
                pdf.save(fileName);
                const waUrl = \`https://wa.me/?text=\${encodeURIComponent(shareText)}\`;
                window.open(waUrl, '_blank');
                toast.success('Biodata PDF generated! Please share it along with the link.', { icon: '📄', duration: 4000 });
            }
        } catch (err) {
            console.error('PDF Share failed:', err);
            toast.error('Failed to generate PDF.');
        } finally {
            setGeneratingBiodata(false);
        }
    };

"@

# Insert after handleDownloadBiodata (roughly)
$content = $content -replace "(const handleDownloadBiodata = async \(\) => \{[\s\S]*? \};)", "`$1`n`n$newFunc"

# 2. Fix the section buttons: replace 'View / Download My Biodata' block with PNG-only button
$pngButton = @"
                                                <button
                                                    id="download-biodata-btn"
                                                    onClick={handleDownloadBiodata}
                                                    disabled={generatingBiodata}
                                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 rounded-xl text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group active:scale-95"
                                                >
                                                    {generatingBiodata ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                                                    Download PNG (Gallery Image)
                                                </button>
"@
# Note: Previous block had verified check and div which I'll preserve
$content = $content -replace '\{myProfile\.status === ''verified'' && \([\s\S]*?<\/button>\s+<\/div>', "{myProfile.status === 'verified' && (`n                                            <div className='flex flex-col gap-3 mt-6'>`n$pngButton"

# 3. Add the Floating PDF Icon (53 branded) below/on-overlap of current FAB
$fab = @"
            {/* 📄 Floating Share Biodata PDF Button (Verified only) - Mobile Friendly */}
            {myProfile?.status === 'verified' && (
                <button
                    onClick={handleSharePDFBiodata}
                    disabled={generatingBiodata}
                    className="fixed bottom-4 right-8 z-[65] w-12 h-12 bg-white text-[#881337] rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all cursor-pointer flex items-center justify-center border-2 border-rose-100 ring-4 ring-[#25D366]/40"
                    title="Generate & Share PDF"
                >
                    {generatingBiodata ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[#881337] text-white font-extrabold text-[12px] shadow-sm transform translate-x-1 translate-y-1">53</div>
                    )}
                </button>
            )}
"@

# Correct current FAB code to be 'Refer' focused if needed, but I'll just append my FAB before the final closing tag
$content = $content -replace '(<\/div>\s+<\/div>\s+)\);', "`$1`n`n$fab`n    );`n"

$content | Set-Content $path -NoNewline
