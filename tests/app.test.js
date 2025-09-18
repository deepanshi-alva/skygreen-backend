const uniqueArray = (arr) =>
    [...new Set([...arr])];


describe('Array utils test', () => {

    describe('uniqueArray', () => {
        it('should give unique array', () => {
            const arr = [1,2,3,4,23,2,1,1,1,];
        const expectedResult = [1,2,3,4,23];
        const result = uniqueArray(arr);

        expect(result).toBeDefined();
        expect(result.length).toBe(expectedResult.length);
        expect(result).toEqual(expectedResult);
        });

        it('should work for empty array', () => {
            const arr = [];
            const result = uniqueArray(arr);

            expect(result).toBeDefined();
            expect(result).toEqual([]);
        })
    });
})