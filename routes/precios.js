const express = require("express");
const router = express.Router();

const db = require("../db");


// ============================================
// CONSTRUIR RESPUESTA
// ============================================

function construirRespuesta(producto) {

    return {

        success: true,

        sku: producto.sku,

        // =====================================
        // FORMATO PARA OTRAS API
        // =====================================

        precios: {

            zr_medic: {
                precio: producto.zr_medic_precio,
                oferta: producto.zr_medic_oferta
            },

            falabella: {
                precio: producto.falabella_precio,
                oferta: producto.falabella_oferta
            },

            mercado_libre: {
                precio: producto.mercado_libre_precio,
                oferta: producto.mercado_libre_oferta
            },

            intercorp: {
                precio: producto.intercorp_precio,
                oferta: producto.intercorp_oferta
            },

            ripley: {
                precio: producto.ripley_precio,
                oferta: producto.ripley_oferta
            },

            juntoz: {
                precio: producto.juntoz_precio,
                oferta: producto.juntoz_oferta
            }

        },

        // =====================================
        // FORMATO PARA FRONTEND
        // =====================================

        canales: [

            {
                canal: "ZR MEDIC",
                precio: producto.zr_medic_precio,
                oferta: producto.zr_medic_oferta
            },

            {
                canal: "Falabella",
                precio: producto.falabella_precio,
                oferta: producto.falabella_oferta
            },

            {
                canal: "Mercado Libre",
                precio: producto.mercado_libre_precio,
                oferta: producto.mercado_libre_oferta
            },

            {
                canal: "Intercorp",
                precio: producto.intercorp_precio,
                oferta: producto.intercorp_oferta
            },

            {
                canal: "Ripley",
                precio: producto.ripley_precio,
                oferta: producto.ripley_oferta
            },

            {
                canal: "Juntoz",
                precio: producto.juntoz_precio,
                oferta: producto.juntoz_oferta
            }

        ]

    };
}


// ============================================
// HEALTH CHECK API PRECIOS
// ============================================

router.get("/health", (req, res) => {

    res.json({
        success: true,
        message: "API de precios funcionando"
    });

});


// ============================================
// CONSULTAR CON ?sku=
// /api/precios?sku=ABC123
// ============================================

router.get("/", async (req, res) => {

    try {

        const sku = String(
            req.query.sku || ""
        ).trim();

        if (!sku) {

            return res.status(400).json({
                success: false,
                message: "Debe enviar el parámetro sku"
            });

        }

        const [rows] = await db.query(
            `
            SELECT

                sku,

                zr_medic_precio,
                zr_medic_oferta,

                falabella_precio,
                falabella_oferta,

                mercado_libre_precio,
                mercado_libre_oferta,

                intercorp_precio,
                intercorp_oferta,

                ripley_precio,
                ripley_oferta,

                juntoz_precio,
                juntoz_oferta

            FROM precios

            WHERE sku = ?

            LIMIT 1
            `,
            [sku]
        );


        if (!rows.length) {

            return res.status(404).json({
                success: false,
                message: "SKU no encontrado",
                sku
            });

        }


        return res.json(
            construirRespuesta(rows[0])
        );


    } catch (error) {

        console.error(
            "ERROR API PRECIOS:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Error consultando precios"
        });

    }

});


// ============================================
// CONSULTAR POR SKU
// /api/precios/ABC123
// ============================================

router.get("/:sku", async (req, res) => {

    try {

        const sku = String(
            req.params.sku || ""
        ).trim();


        if (!sku) {

            return res.status(400).json({
                success: false,
                message: "Debe ingresar un SKU"
            });

        }


        const [rows] = await db.query(
            `
            SELECT

                sku,

                zr_medic_precio,
                zr_medic_oferta,

                falabella_precio,
                falabella_oferta,

                mercado_libre_precio,
                mercado_libre_oferta,

                intercorp_precio,
                intercorp_oferta,

                ripley_precio,
                ripley_oferta,

                juntoz_precio,
                juntoz_oferta

            FROM precios

            WHERE sku = ?

            LIMIT 1
            `,
            [sku]
        );


        if (!rows.length) {

            return res.status(404).json({

                success: false,

                message:
                    "SKU no encontrado",

                sku

            });

        }


        return res.status(200).json(
            construirRespuesta(rows[0])
        );


    } catch (error) {

        console.error(
            "ERROR CONSULTANDO PRECIO:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Error interno consultando los precios"

        });

    }

});


module.exports = router;