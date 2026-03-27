export const computeMatchScore = (me: any, them: any) => {
    if (!me || !them) return 50;

    let score = 50; // Base community match score

    // 1. Location Matching
    if (me.country && them.country && me.country.toLowerCase() === them.country.toLowerCase()) score += 10;
    if (me.state && them.state && me.state.toLowerCase() === them.state.toLowerCase()) score += 10;
    if (me.city && them.city && me.city.toLowerCase() === them.city.toLowerCase()) score += 10;

    // 2. Age Compatibility
    const myAge = me.dob ? Math.floor((Date.now() - new Date(me.dob).getTime()) / 31557600000) : 25;
    const theirAge = them.dob ? Math.floor((Date.now() - new Date(them.dob).getTime()) / 31557600000) : 25;
    const ageDiff = Math.abs(myAge - theirAge);

    if (me.gender === 'male' && theirAge <= myAge && theirAge >= myAge - 6) score += 15;
    else if (me.gender === 'female' && myAge <= theirAge && myAge >= theirAge - 6) score += 15;
    else score -= Math.max(0, (ageDiff - 6) * 2);

    // 3. Ancestral Watan Match (Strong community signal)
    if (me.ancestralWatan && them.ancestralWatan && 
        me.ancestralWatan.toLowerCase().trim() === them.ancestralWatan.toLowerCase().trim()) {
        score += 15;
    }

    // 4. Interests & Hobbies
    const myHobbies = (me.hobbies || '').toLowerCase();
    const theirHobbies = (them.hobbies || '').toLowerCase();
    
    if (myHobbies && theirHobbies) {
        const hWords = myHobbies.split(/[,\s]+/).filter((w: string) => w.length > 3);
        hWords.forEach((w: string) => {
            if (theirHobbies.includes(w)) score += 5;
        });
    }

    // 5. Partner Requirements vs Profile
    const myReqs = (me.partnerQualities || '').toLowerCase();
    if (myReqs && (them.education || them.profession || them.professionType)) {
        const rWords = myReqs.split(/[,\s]+/).filter((w: string) => w.length > 3);
        let matched = false;
        rWords.forEach((w: string) => {
            if (
                (them.education || '').toLowerCase().includes(w) || 
                (them.profession || '').toLowerCase().includes(w) || 
                (them.professionType || '').toLowerCase().includes(w) || 
                theirHobbies.includes(w)
            ) {
                matched = true;
            }
        });
        if (matched) score += 10;
    }

    // 6. Deeni Alignment (Hifz Status)
    if (me.hifzStatus && them.hifzStatus && me.hifzStatus === them.hifzStatus) {
        score += 5;
    }

    // Final normalization
    return Math.min(99, Math.max(30, score));
};
